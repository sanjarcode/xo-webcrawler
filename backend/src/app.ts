import { UrlLoaderService } from "./services/url-loader.service.js";
import { Command } from "commander";
import Queue from "queue-fifo";

interface AppParameters {
  url: string;
  word: string;
  level: number;
}

export const DEFAULT_URL = "https://www.kayako.com/";
export const DEFAULT_WORD = "kayako";
export const DEFAULT_LEVEL = "0";

export class App {
  /* istanbul ignore next */
  constructor(
    private readonly urlLoader: UrlLoaderService,
    private readonly command = new Command(),
    private wordCount = 0
  ) {}

  async run(): Promise<void> {
    const appParameters = this.parseCli();

    await this.process(appParameters);
  }

  async process(appParameters: AppParameters): Promise<void> {
    // const extractedText = await this.urlLoader.loadUrlTextAndLinks(
    //   appParameters.url
    // );
    // const count = (
    //   extractedText.text.toLocaleLowerCase().match(/kayako/gi) ?? []
    // ).length;
    // this.wordCount++;

    const queue = new Queue();
    const seen = new Set(); // avoid cycles
    let count = 0;
    let maxlevel = 0;
    queue.enqueue(appParameters.url);
    while (!queue.isEmpty()) {
      const currentUrl = `${queue.dequeue()}`;
      seen.add(currentUrl);

      const extractedText = await this.urlLoader.loadUrlTextAndLinks(
        currentUrl
      );
      count += (extractedText.text.toLocaleLowerCase().match(/kayako/gi) ?? [])
        .length;

      // enqueue other links
      if (maxlevel < appParameters.level) {
        for (let link in extractedText.links) {
          if (!(link in seen)) queue.enqueue(link);
        }
        maxlevel++;
      }
    }

    console.log(
      `Found ${count} instances of '${appParameters.word}' in the body of the page '${appParameters.url}', at max level ${appParameters.level}`
    );
  }

  parseCli(argv: readonly string[] = process.argv): AppParameters {
    this.command.requiredOption("-u, --url <url>", "URL to load", DEFAULT_URL);
    this.command.option("-w, --word <word>", "Word to match", DEFAULT_WORD);
    this.command.option(
      "-l, --level <level>",
      "Level to look at",
      DEFAULT_LEVEL
    );

    this.command.parse(argv);
    const options = this.command.opts();

    return { url: options.url, word: options.word, level: options.level };
  }
}
