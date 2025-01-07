import Handlebars from "handlebars";
import { cleanHtml } from "./stringTools";

// Types for feed construction
interface AtomPerson {
  /** Required. A human-readable name for the person. */
  name: string;
  /** Optional. Email address for the person. */
  email?: string;
  /** Optional. Home page for the person. */
  uri?: string;
}

interface AtomLink {
  /** Required. The URI of the referenced resource (typically a Web page)*/
  href: string;
  /** Optional. Contains a single link relationship type. It can be a full URI or one of the following predefined values (default=alternate).
   * alternate: An alternate representation of the entry or feed, for example a permalink to the html version of the entry, or the front page of the weblog.
   * enclosure: A related resource which is potentially large in size and might require special handling, for example an audio or video recording.
   * related: An document related to the entry or feed.
   * self: The feed itself.
   * via: The source of the information provided in the entry.
   */
  rel?: "alternate" | "enclosure" | "related" | "self" | "via";
  /** Optional. Indicates the media type of the resource. */
  type?: string;
  /** Optional. Indicates the language of the referenced resource. */
  hreflang?: string;
  /** Optional. Human readable information about the link, typically for display purposes. */
  title?: string;
  /** Optional. The length of the resource, in bytes. */
  length?: number;
}

interface AtomCategory {
  /** Required. Identifies the category. */
  term: string;
  /** Optional. Identifies the categorization scheme via a URI. */
  scheme?: string;
  /** Optional. Provides a human-readable label for display. */
  label?: string;
}

interface AtomText {
  /** Optional. Defaults to text. */
  type?: "text" | "html" | "xhtml";
  /** The content in the specified format. */
  content: string;
}

/** There is additional support for "...+xml" or ".../xml" in the spec and for  "text...", but that's not implemented here. */
type AtomContent =
  | AtomText
  | {
      /** Represents the URI of where the content can be found. The type attribute, if present, is the media type of the content. */
      src: string;
      /** The media type of the content */
      type?: string;
    };

interface AtomGenerator {
  /** Required. Name of the software used to generate the feed. */
  content: string;
  /** Optional. Link to the software. */
  uri?: string;
  /** Optional. Version of the software. */
  version?: string;
}

interface AtomSource {
  /** Required. */
  id: string;
  /** Required. */
  title: string;
  /** Required. */
  updated: Date;
}

interface AtomEntryOptions {
  /** Required. Identifies the entry using a universally unique and permanent URI. Two entries in a feed can have the same value for id if they represent the same entry at different points in time. */
  id: string;
  /** Required. Contains a human readable title for the entry. This value should not be blank. */
  title: string;
  /** Required. Indicates the last time the entry was modified in a significant way. This value need not change after a typo is fixed, only after a substantial modification. Generally, different entries in a feed will have different updated timestamps. */
  updated: Date;
  /** Recommended. Names one author of the entry. An entry may have multiple authors. An entry must contain at least one author element unless there is an author element in the enclosing feed, or there is an author element in the enclosed source element. */
  author?: AtomPerson[];
  /** Recommended. Contains or links to the complete content of the entry. Content must be provided if there is no alternate link, and should be provided if there is no summary. */
  content?: AtomContent;
  /** Recommended. Identifies a related Web page. The type of relation is defined by the rel attribute. An entry is limited to one alternate per type and hreflang. An entry must contain an alternate link if there is no content element. */
  link?: AtomLink[];
  /** Recommended. Conveys a short summary, abstract, or excerpt of the entry. Summary should be provided if there either is no content provided for the entry, or that content is not inline (i.e., contains a src attribute), or if the content is encoded in base64.  */
  summary?: AtomText;
  /** Optional. Specifies a category that the entry belongs to. A entry may have multiple category elements. */
  category?: AtomCategory[];
  /** Optional. Names one contributor to the entry. An entry may have multiple contributor elements */
  contributor?: AtomPerson[];
  /** Optional. Contains the time of the initial creation or first availability of the entry. */
  published?: Date;
  /** Optional. Conveys information about rights, e.g. copyrights, held in and over the entry. */
  rights?: AtomText;
  /** Contains metadata from the source feed if this entry is a copy. */
  source?: AtomSource;
}

interface AtomFeedOptions {
  /** Required. Identifies the feed using a universally unique and permanent URI. If you have a long-term, renewable lease on your Internet domain name, then you can feel free to use your website's address. */
  id: string;
  /** Required. Contains a human readable title for the feed. Often the same as the title of the associated website. This value should not be blank. */
  title: string;
  /** Required. Indicates the last time the feed was modified in a significant way. If not provided, the latest updated value of the entries is used. */
  updated?: Date;
  /** Recommended. Names one author of the feed. A feed may have multiple author elements. A feed must contain at least one author element unless all of the entry elements contain at least one author element. */
  author?: AtomPerson[];
  /** Recommended. Identifies a related Web page. The type of relation is defined by the rel attribute. A feed is limited to one alternate per type and hreflang. A feed should contain a link back to the feed itself. */
  link?: AtomLink[];
  /** Optional. Specifies a category that the feed belongs to. A feed may have multiple category elements. */
  category?: AtomCategory[];
  /** Optional. Names one contributor to the feed. An feed may have multiple contributor elements. */
  contributor?: AtomPerson[];
  /** Optional. Identifies the software used to generate the feed, for debugging and other purposes. */
  generator?: AtomGenerator;
  /** Optional. Identifies a small image which provides iconic visual identification for the feed. Icons should be square. */
  icon?: string;
  /** Optional. Identifies a larger image which provides visual identification for the feed. Images should be twice as wide as they are tall. */
  logo?: string;
  /** Optional. Conveys information about rights, e.g. copyrights, held in and over the feed. */
  rights?: AtomText;
  /** Optional. Contains a human-readable description or subtitle for the feed. */
  subtitle?: AtomText;
  /** Optional. Language of the feed (e.g. "en") */
  language?: string;
}

// Helper functions
function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatISODate(date: Date): string {
  return date.toISOString();
}

// Register Handlebars helpers
Handlebars.registerHelper("escapeXml", (uri: string) => {
  return new Handlebars.SafeString(escapeXml(uri));
});

Handlebars.registerHelper("isoDate", formatISODate);

Handlebars.registerHelper("renderLinkAttributes", (link: AtomLink) => {
  const attributes: string[] = [];
  attributes.push(`href="${escapeXml(link.href)}"`);
  if (link.rel) attributes.push(`rel="${link.rel}"`);
  if (link.type) attributes.push(`type="${link.type}"`);
  if (link.hreflang) attributes.push(`hreflang="${link.hreflang}"`);
  if (link.title) attributes.push(`title="${link.title}"`);
  if (link.length !== undefined)
    attributes.push(`length="${link.length.toFixed()}"`);
  return new Handlebars.SafeString(attributes.join(" "));
});

Handlebars.registerHelper(
  "renderContent",
  (content: AtomContent, elementName: string) => {
    if ("src" in content) {
      const attrs = [`src="${escapeXml(content.src)}"`];
      if (content.type) attrs.push(`type="${content.type}"`);
      return new Handlebars.SafeString(`<${elementName} ${attrs.join(" ")}/>`);
    }

    const pre = '<div xmlns="http://www.w3.org/1999/xhtml">';
    const post = "</div>";
    const attrs = content.type ? ` type="${content.type}"` : "";
    return new Handlebars.SafeString(
      `<${elementName}${attrs}>${pre}${content.content}${post}</${elementName}>`,
    );
  },
);

// Entry template
const entryTemplate = Handlebars.compile(`
<entry>
  <id>{{id}}</id>
  <title>{{{escapeXml title}}}</title>
  <updated>{{isoDate updated}}</updated>

  {{#each author}}
  <author>
    <name>{{name}}</name>
    {{#if email}}<email>{{email}}</email>{{/if}}
    {{#if uri}}<uri>{{escapeXml uri}}</uri>{{/if}}
  </author>
  {{/each}}

  {{#if content}}
    {{renderContent content "content"}}
  {{/if}}

  {{#each link}}
  <link {{renderLinkAttributes this}}/>
  {{/each}}

  {{#if summary}}
  <summary{{#if summary.type}} type="{{summary.type}}"{{/if}}>{{summary.content}}</summary>
  {{/if}}

  {{#each category}}
  <category term="{{term}}"{{#if scheme}} scheme="{{escapeXml scheme}}"{{/if}}{{#if label}} label="{{label}}"{{/if}}/>
  {{/each}}

  {{#each contributor}}
  <contributor>
    <name>{{name}}</name>
    {{#if email}}<email>{{email}}</email>{{/if}}
    {{#if uri}}<uri>{{escapeXml uri}}</uri>{{/if}}
  </contributor>
  {{/each}}

  {{#if published}}
  <published>{{isoDate published}}</published>
  {{/if}}

  {{#if rights}}
  <rights{{#if rights.type}} type="{{rights.type}}"{{/if}}>{{rights.content}}</rights>
  {{/if}}

  {{#if source}}
  <source>
    <id>{{source.id}}</id>
    <title>{{source.title}}</title>
    <updated>{{isoDate source.updated}}</updated>
  </source>
  {{/if}}
</entry>
`);

// Feed template
const feedTemplate = Handlebars.compile(`<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"{{#if language}} xml:lang="{{language}}"{{/if}}>
  <id>{{id}}</id>
  <title>{{{escapeXml title}}}</title>
  <updated>{{isoDate updated}}</updated>

  {{#each author}}
  <author>
    <name>{{name}}</name>
    {{#if email}}<email>{{email}}</email>{{/if}}
    {{#if uri}}<uri>{{escapeXml uri}}</uri>{{/if}}
  </author>
  {{/each}}

  {{#each link}}
  <link {{renderLinkAttributes this}}/>
  {{/each}}

  {{#each category}}
  <category term="{{term}}"{{#if scheme}} scheme="{{escapeXml scheme}}"{{/if}}{{#if label}} label="{{label}}"{{/if}}/>
  {{/each}}

  {{#each contributor}}
  <contributor>
    <name>{{name}}</name>
    {{#if email}}<email>{{email}}</email>{{/if}}
    {{#if uri}}<uri>{{escapeXml uri}}</uri>{{/if}}
  </contributor>
  {{/each}}

  {{#if generator}}
  <generator{{#if generator.uri}} uri="{{escapeXml generator.uri}}"{{/if}}{{#if generator.version}} version="{{generator.version}}"{{/if}}>{{generator.content}}</generator>
  {{/if}}

  {{#if icon}}
  <icon>{{escapeXml icon}}</icon>
  {{/if}}

  {{#if logo}}
  <logo>{{escapeXml logo}}</logo>
  {{/if}}

  {{#if rights}}
  <rights{{#if rights.type}} type="{{rights.type}}"{{/if}}>{{rights.content}}</rights>
  {{/if}}

  {{#if subtitle}}
  <subtitle{{#if subtitle.type}} type="{{subtitle.type}}"{{/if}}>{{subtitle.content}}</subtitle>
  {{/if}}

  {{#each entries}}
  {{{this}}}
  {{/each}}
</feed>
`);

class AtomEntry {
  readonly options: AtomEntryOptions;

  constructor(options: AtomEntryOptions) {
    this.options = options;
  }

  toXML(): string {
    return entryTemplate(this.options);
  }
}

/**
 * Generates an Atom feed.
 * See https://tools.ietf.org/html/rfc4287 for the specification.
 */
class AtomFeed {
  private readonly options: AtomFeedOptions;
  private readonly entries: AtomEntry[] = [];

  constructor(options: AtomFeedOptions) {
    this.options = options;
  }

  addEntry(entry: AtomEntryOptions): void {
    this.entries.push(new AtomEntry(entry));
  }

  toXML(): string {
    let updated = this.options.updated;

    if (!updated && this.entries.length > 0) {
      // Find the latest updated date from the entries
      updated = this.entries.reduce((acc, entry) => {
        const entryUpdated = entry.options.updated;
        return entryUpdated > acc ? entryUpdated : acc;
      }, this.entries[0].options.updated);
    }

    // If no updated date is set or can be determined, use the current date
    if (!updated) {
      updated = new Date();
    }

    return cleanHtml(
      feedTemplate({
        ...this.options,
        entries: this.entries.map((entry) => entry.toXML()),
      }),
    );
  }
}

export { AtomFeed };
