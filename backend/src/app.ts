import { UrlLoaderService } from './services/url-loader.service.js'
import { Command } from 'commander'
import Queue from 'queue-fifo'

interface AppParameters {
  url: string
  word: string
  level: number
}

export const DEFAULT_URL = 'https://www.kayako.com/'
export const DEFAULT_WORD = 'kayako'
export const DEFAULT_LEVEL = '2'

export class App {
  /* istanbul ignore next */
  constructor (
    private readonly urlLoader: UrlLoaderService,
    private readonly command = new Command()
  ) {}

  async run (): Promise<void> {
    const appParameters = this.parseCli()

    await this.process(appParameters)
  }

  async process (appParameters: AppParameters): Promise<void> {
    const queue: Queue<[string, number]> = new Queue()
    const seen = new Set() // avoid cycles
    let count = 0

    queue.enqueue([appParameters.url, 0])
    while (!queue.isEmpty()) {
      const [currentUrl, currentLevel]: [string, number] = queue.dequeue() ?? ['', 0]
      // console.log(currentUrl, count)
      seen.add(currentUrl)
      const extractedText = await this.urlLoader.loadUrlTextAndLinks(
        currentUrl
      )
      count += (
        extractedText.text
          .toLocaleLowerCase()
          .match(new RegExp(appParameters.word, 'gi')) ?? []
      ).length

      // sanitize content links
      const links = new Set(
        extractedText.links.map((unsanitizedLink) => {
          unsanitizedLink = unsanitizedLink.replace('www.', '') // subdomain sanitization

          const hashIndex = unsanitizedLink.indexOf('#') // content page sanitization
          if (hashIndex === -1) return unsanitizedLink
          return unsanitizedLink.substring(0, hashIndex)
        })
      )

      if (currentLevel < appParameters.level) {
        for (const link of links) {
          if (!seen.has(link)) { queue.enqueue([link, currentLevel + 1]); seen.add(link) }
          // else console.log('Seen', link)
        }
      }
    }

    console.log(
      `Found ${count} instances of '${appParameters.word}' in the body of the page`
    )
  }

  parseCli (argv: readonly string[] = process.argv): AppParameters {
    this.command.requiredOption('-u, --url <url>', 'URL to load', DEFAULT_URL)
    this.command.option('-w, --word <word>', 'Word to match', DEFAULT_WORD)
    this.command.option(
      '-l, --level <level>',
      'Level to look at',
      DEFAULT_LEVEL
    )

    this.command.parse(argv)
    const options = this.command.opts()

    return { url: options.url, word: options.word, level: options.level }
  }
}
