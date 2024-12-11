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
  /** Required. Indicates the last time the feed was modified in a significant way. */
  updated: Date;
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

class AtomEntry {
  private readonly id: string;
  private readonly title: string;
  private readonly updated: Date;
  private readonly author?: AtomPerson[];
  private readonly content?: AtomContent;
  private readonly link?: AtomLink[];
  private readonly summary?: AtomText;
  private readonly category?: AtomCategory[];
  private readonly contributor?: AtomPerson[];
  private readonly published?: Date;
  private readonly rights?: AtomText;
  private readonly source?: AtomSource;

  constructor(options: AtomEntryOptions) {
    this.id = options.id;
    this.title = options.title;
    this.updated = options.updated;
    if (options.author) this.author = options.author;
    if (options.content) this.content = options.content;
    if (options.link) this.link = options.link;
    if (options.summary) this.summary = options.summary;
    if (options.category) this.category = options.category;
    if (options.contributor) this.contributor = options.contributor;
    if (options.published) this.published = options.published;
    if (options.rights) this.rights = options.rights;
    if (options.source) this.source = options.source;
  }

  private renderPerson(person: AtomPerson, indent: number): string[] {
    const spacing = " ".repeat(indent);
    const lines: string[] = [];
    lines.push(`${spacing}<name>${person.name}</name>`);
    if (person.email) lines.push(`${spacing}<email>${person.email}</email>`);
    if (person.uri) lines.push(`${spacing}<uri>${person.uri}</uri>`);
    return lines;
  }

  private renderContent(
    content: AtomContent,
    elementName: string,
    indent: number,
  ): string {
    const spacing = " ".repeat(indent);

    // Handle src-type content
    if ("src" in content) {
      const attrs = [`src="${content.src}"`];
      if (content.type) attrs.push(`type="${content.type}"`);
      return `${spacing}<${elementName} ${attrs.join(" ")}/>`;
    }

    // Handle text-type content
    const pre = '<div xmlns="http://www.w3.org/1999/xhtml">';
    const post = "</div>";
    const attrs = content.type ? ` type="${content.type}"` : "";
    return `${spacing}<${elementName}${attrs}>${pre}${content.content}${post}</${elementName}>`;
  }

  private renderAtomText(
    text: AtomText,
    elementName: string,
    indent: number,
  ): string {
    const spacing = " ".repeat(indent);
    const attrs = text.type ? ` type="${text.type}"` : "";
    return `${spacing}<${elementName}${attrs}>${text.content}</${elementName}>`;
  }

  toXML(): string {
    const lines: string[] = ["<entry>"];

    // Required elements
    lines.push(`  <id>${this.id}</id>`);
    lines.push(`  <title>${this.title}</title>`);
    lines.push(`  <updated>${this.updated.toISOString()}</updated>`);

    // Author elements
    if (this.author?.length) {
      for (const author of this.author) {
        lines.push("  <author>");
        for (const line of this.renderPerson(author, 4)) {
          lines.push(line);
        }
        lines.push("  </author>");
      }
    }

    // Content element
    if (this.content) {
      lines.push(this.renderContent(this.content, "content", 2));
    }

    // Link elements
    if (this.link?.length) {
      for (const link of this.link) {
        lines.push(`  <link ${renderLinkAttributes(link)} />`);
      }
    }

    // Summary element
    if (this.summary) {
      lines.push(this.renderAtomText(this.summary, "summary", 2));
    }

    // Category elements
    if (this.category?.length) {
      for (const cat of this.category) {
        const attrs = [`term="${cat.term}"`];
        if (cat.scheme) attrs.push(`scheme="${cat.scheme}"`);
        if (cat.label) attrs.push(`label="${cat.label}"`);
        lines.push(`  <category ${attrs.join(" ")}/>`);
      }
    }

    // Contributor elements
    if (this.contributor?.length) {
      for (const contributor of this.contributor) {
        lines.push("  <contributor>");
        for (const line of this.renderPerson(contributor, 4)) {
          lines.push(line);
        }
        lines.push("  </contributor>");
      }
    }

    // Published date
    if (this.published) {
      lines.push(`  <published>${this.published.toISOString()}</published>`);
    }

    // Rights
    if (this.rights) {
      lines.push(this.renderAtomText(this.rights, "rights", 2));
    }

    // Source
    if (this.source) {
      lines.push("  <source>");
      lines.push(`    <id>${this.source.id}</id>`);
      lines.push(`    <title>${this.source.title}</title>`);
      lines.push(`    <updated>${this.source.updated.toISOString()}</updated>`);
      lines.push("  </source>");
    }

    lines.push("</entry>");
    return lines.join("\n");
  }
}

class AtomFeed {
  private readonly id: string;
  private readonly title: string;
  private readonly updated: Date;
  private readonly author?: AtomPerson[];
  private readonly link?: AtomLink[];
  private readonly category?: AtomCategory[];
  private readonly contributor?: AtomPerson[];
  private readonly generator?: AtomGenerator;
  private readonly icon?: string;
  private readonly logo?: string;
  private readonly rights?: AtomText;
  private readonly subtitle?: AtomText;
  private readonly language?: string;
  private readonly entries: AtomEntry[] = [];

  constructor(options: AtomFeedOptions) {
    this.id = options.id;
    this.title = options.title;
    this.updated = options.updated;
    if (options.author) this.author = options.author;
    if (options.link) this.link = options.link;
    if (options.category) this.category = options.category;
    if (options.contributor) this.contributor = options.contributor;
    if (options.generator) this.generator = options.generator;
    if (options.icon) this.icon = options.icon;
    if (options.logo) this.logo = options.logo;
    if (options.rights) this.rights = options.rights;
    if (options.subtitle) this.subtitle = options.subtitle;
    if (options.language) this.language = options.language;
  }

  addEntry(entry: AtomEntryOptions): void {
    this.entries.push(new AtomEntry(entry));
  }

  toXML(): string {
    const lines: string[] = [
      '<?xml version="1.0" encoding="utf-8"?>',
      `<feed xmlns="http://www.w3.org/2005/Atom"${this.language ? ` xml:lang="${this.language}"` : ""}>`,
    ];

    // Required elements
    lines.push(`  <id>${this.id}</id>`);
    lines.push(`  <title>${this.title}</title>`);
    lines.push(`  <updated>${this.updated.toISOString()}</updated>`);

    // Recommended elements
    if (this.author?.length) {
      for (const author of this.author) {
        lines.push("  <author>");
        lines.push(`    <name>${author.name}</name>`);
        if (author.email) lines.push(`    <email>${author.email}</email>`);
        if (author.uri) lines.push(`    <uri>${author.uri}</uri>`);
        lines.push("  </author>");
      }
    }

    // Optional elements - Links
    if (this.link?.length) {
      for (const link of this.link) {
        lines.push(`  <link ${renderLinkAttributes(link)}/>`);
      }
    }

    // Optional elements - Categories
    if (this.category?.length) {
      for (const cat of this.category) {
        const attrs = [`term="${cat.term}"`];
        if (cat.scheme) attrs.push(`scheme="${cat.scheme}"`);
        if (cat.label) attrs.push(`label="${cat.label}"`);
        lines.push(`  <category ${attrs.join(" ")}/>`);
      }
    }

    // Optional elements - Contributors
    if (this.contributor?.length) {
      for (const contributor of this.contributor) {
        lines.push("  <contributor>");
        lines.push(`    <name>${contributor.name}</name>`);
        if (contributor.email)
          lines.push(`    <email>${contributor.email}</email>`);
        if (contributor.uri) lines.push(`    <uri>${contributor.uri}</uri>`);
        lines.push("  </contributor>");
      }
    }

    // Optional elements - Generator
    if (this.generator) {
      const attrs: string[] = [];
      if (this.generator.uri) attrs.push(`uri="${this.generator.uri}"`);
      if (this.generator.version)
        attrs.push(`version="${this.generator.version}"`);
      const attrsStr = attrs.length ? ` ${attrs.join(" ")}` : "";
      lines.push(
        `  <generator${attrsStr}>${this.generator.content}</generator>`,
      );
    }

    // Optional elements - Icon
    if (this.icon) {
      lines.push(`  <icon>${this.icon}</icon>`);
    }

    // Optional elements - Logo
    if (this.logo) {
      lines.push(`  <logo>${this.logo}</logo>`);
    }

    // Optional elements - Rights
    if (this.rights) {
      const attrs = this.rights.type ? ` type="${this.rights.type}"` : "";
      lines.push(`  <rights${attrs}>${this.rights.content}</rights>`);
    }

    // Optional elements - Subtitle
    if (this.subtitle) {
      const attrs = this.subtitle.type ? ` type="${this.subtitle.type}"` : "";
      lines.push(`  <subtitle${attrs}>${this.subtitle.content}</subtitle>`);
    }

    // Add entries
    for (const entry of this.entries) {
      lines.push(
        entry
          .toXML()
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n"),
      );
    }

    lines.push("</feed>");
    return lines.join("\n");
  }
}

// Type-safe function to render link attributes
function renderLinkAttributes(link: AtomLink): string {
  const attributes: string[] = [];

  // Required
  attributes.push(`href="${encodeUriForXhtml(link.href)}"`);

  // Optional
  if (link.rel) attributes.push(`rel="${link.rel}"`);
  if (link.type) attributes.push(`type="${link.type}"`);
  if (link.hreflang) attributes.push(`hreflang="${link.hreflang}"`);
  if (link.title) attributes.push(`title="${link.title}"`);
  if (link.length !== undefined)
    attributes.push(`length="${link.length.toFixed(0)}"`);

  return attributes.join(" ");
}

function encodeUriForXhtml(uri: string): string {
  return encodeURI(uri)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
export { AtomFeed, AtomEntry, type AtomFeedOptions, type AtomEntryOptions };
