use crate::TocEntry;
use pulldown_cmark::{html, BlockQuoteKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};

/// Extract YAML frontmatter from Markdown content.
pub fn extract_frontmatter(content: &str) -> (Option<String>, &str) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (None, content);
    }
    let after_first = &trimmed[3..];
    if let Some(end_pos) = after_first.find("\n---") {
        let fm = after_first[..end_pos].trim().to_string();
        let body_start = 3 + end_pos + 4;
        let body = &trimmed[body_start..];
        (Some(fm), body)
    } else {
        (None, content)
    }
}

fn heading_level_to_u32(level: HeadingLevel) -> u32 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

fn slugify(text: &str) -> String {
    text.chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c.to_lowercase().next().unwrap_or(c)
            } else if c == ' ' || c == '-' {
                '-'
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

/// Render Markdown to HTML and extract TOC entries.
pub fn render_to_html(content: &str) -> (String, Vec<TocEntry>) {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);
    options.insert(Options::ENABLE_GFM);

    // ─── First pass: collect TOC ─────────────────────────
    let mut toc = Vec::new();
    let mut heading_text = String::new();
    let mut in_heading = false;
    let mut current_heading_level: Option<u32> = None;

    let parser_toc = Parser::new_ext(content, options);
    for event in parser_toc {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                in_heading = true;
                current_heading_level = Some(heading_level_to_u32(level));
                heading_text.clear();
            }
            Event::Text(text) if in_heading => heading_text.push_str(&text),
            Event::Code(code) if in_heading => heading_text.push_str(&code),
            Event::End(TagEnd::Heading(_)) => {
                if let Some(level) = current_heading_level {
                    let id = slugify(&heading_text);
                    toc.push(TocEntry { level, text: heading_text.clone(), id });
                }
                in_heading = false;
                current_heading_level = None;
            }
            _ => {}
        }
    }

    // ─── Second pass: generate HTML ──────────────────────
    let parser = Parser::new_ext(content, options);
    let events: Vec<Event> = parser.collect();
    let mut html_output = String::with_capacity(content.len() * 2);
    let mut modified_events: Vec<Event> = Vec::with_capacity(events.len());

    let mut toc_idx = 0;
    let mut skip_code_block = false;
    let mut code_block_lang = String::new();
    let mut code_block_content = String::new();
    // Track alert blockquotes so we close with </div> instead of </blockquote>
    let mut alert_depth: Vec<bool> = Vec::new();

    let mut i = 0;
    while i < events.len() {
        let event = &events[i];
        match event {
            // ─── Headings with anchors ───────────────────
            Event::Start(Tag::Heading { level, .. }) => {
                let lvl = heading_level_to_u32(*level);
                if toc_idx < toc.len() {
                    let id = &toc[toc_idx].id;
                    modified_events.push(Event::Html(
                        format!("<h{} id=\"{}\"><a class=\"anchor\" href=\"#{}\"></a>", lvl, id, id).into(),
                    ));
                    i += 1;
                    while i < events.len() {
                        match &events[i] {
                            Event::End(TagEnd::Heading(_)) => {
                                modified_events.push(Event::Html(format!("</h{}>", lvl).into()));
                                toc_idx += 1;
                                break;
                            }
                            other => modified_events.push(other.clone()),
                        }
                        i += 1;
                    }
                } else {
                    modified_events.push(event.clone());
                }
            }

            // ─── Code blocks (mermaid, math, normal) ─────
            Event::Start(Tag::CodeBlock(kind)) => {
                let lang = match kind {
                    pulldown_cmark::CodeBlockKind::Fenced(lang) => lang.to_string(),
                    _ => String::new(),
                };
                if lang == "mermaid" || lang == "math" || lang == "katex" {
                    skip_code_block = true;
                    code_block_lang = lang;
                    code_block_content.clear();
                } else {
                    let lang_class = if lang.is_empty() {
                        String::new()
                    } else {
                        format!(" class=\"language-{}\"", lang)
                    };
                    modified_events.push(Event::Html(
                        format!(
                            "<div class=\"code-block-wrapper\" data-lang=\"{}\"><div class=\"code-block-header\"><span class=\"code-lang\">{}</span><button class=\"copy-btn\" onclick=\"copyCodeBlock(this)\">Copy</button></div><pre><code{}>",
                            lang, lang, lang_class
                        ).into(),
                    ));
                }
            }
            Event::Text(text) if skip_code_block => {
                code_block_content.push_str(text);
            }
            Event::End(TagEnd::CodeBlock) if skip_code_block => {
                skip_code_block = false;
                if code_block_lang == "mermaid" {
                    modified_events.push(Event::Html(
                        format!(
                            "<div class=\"mermaid-wrapper\"><pre class=\"mermaid\">{}</pre></div>",
                            html_escape(&code_block_content)
                        ).into(),
                    ));
                } else {
                    modified_events.push(Event::Html(
                        format!(
                            "<div class=\"katex-block\" data-expr=\"{}\"></div>",
                            html_escape(&code_block_content)
                        ).into(),
                    ));
                }
            }
            Event::End(TagEnd::CodeBlock) => {
                modified_events.push(Event::Html("</code></pre></div>".to_string().into()));
            }

            // ─── BlockQuote / GitHub Alerts (native) ─────
            Event::Start(Tag::BlockQuote(kind)) => {
                if let Some(alert_kind) = kind {
                    let (css_class, icon, label) = match alert_kind {
                        BlockQuoteKind::Note      => ("note",      "\u{2139}\u{FE0F}", "Note"),
                        BlockQuoteKind::Tip       => ("tip",       "\u{1F4A1}",         "Tip"),
                        BlockQuoteKind::Important  => ("important", "\u{2757}",          "Important"),
                        BlockQuoteKind::Warning   => ("warning",   "\u{26A0}\u{FE0F}",  "Warning"),
                        BlockQuoteKind::Caution   => ("caution",   "\u{1F534}",          "Caution"),
                    };
                    modified_events.push(Event::Html(
                        format!(
                            "<div class=\"markdown-alert markdown-alert-{}\"><p class=\"markdown-alert-title\">{} {}</p>",
                            css_class, icon, label
                        ).into(),
                    ));
                    alert_depth.push(true);
                } else {
                    modified_events.push(event.clone());
                    alert_depth.push(false);
                }
            }
            Event::End(TagEnd::BlockQuote(_)) => {
                let is_alert = alert_depth.pop().unwrap_or(false);
                if is_alert {
                    modified_events.push(Event::Html("</div>".to_string().into()));
                } else {
                    modified_events.push(event.clone());
                }
            }

            // ─── Everything else ─────────────────────────
            _ => {
                modified_events.push(event.clone());
            }
        }
        i += 1;
    }

    html::push_html(&mut html_output, modified_events.into_iter());

    // Post-process: inline math $...$ and $$...$$
    let html_output = process_inline_math(&html_output);

    (html_output, toc)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Process inline math: $expr$ → KaTeX span, $$expr$$ → KaTeX block div
fn process_inline_math(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let chars: Vec<char> = html.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        // Skip HTML tags
        if chars[i] == '<' {
            let tag_start = i;
            while i < len && chars[i] != '>' {
                result.push(chars[i]);
                i += 1;
            }
            if i < len {
                result.push(chars[i]);
                i += 1;
            }
            let tag_content: String = chars[tag_start..i].iter().collect();
            if tag_content.starts_with("<code") || tag_content.starts_with("<pre") {
                let close_tag = if tag_content.starts_with("<code") { "</code>" } else { "</pre>" };
                while i < len {
                    let remaining: String = chars[i..].iter().collect();
                    if remaining.starts_with(close_tag) {
                        for c in close_tag.chars() {
                            result.push(c);
                            i += 1;
                        }
                        break;
                    }
                    result.push(chars[i]);
                    i += 1;
                }
            }
            continue;
        }

        // $$ block math
        if i + 1 < len && chars[i] == '$' && chars[i + 1] == '$' {
            i += 2;
            let start = i;
            while i + 1 < len && !(chars[i] == '$' && chars[i + 1] == '$') {
                i += 1;
            }
            if i + 1 < len {
                let expr: String = chars[start..i].iter().collect();
                result.push_str(&format!(
                    "<div class=\"katex-block\" data-expr=\"{}\"></div>",
                    html_escape(&expr)
                ));
                i += 2;
            } else {
                result.push_str("$$");
                i = start;
            }
            continue;
        }

        // $ inline math
        if chars[i] == '$' && (i == 0 || !chars[i - 1].is_alphanumeric()) {
            let start = i + 1;
            let mut end = start;
            while end < len && chars[end] != '$' && chars[end] != '\n' {
                end += 1;
            }
            if end < len && chars[end] == '$' && end > start {
                let expr: String = chars[start..end].iter().collect();
                result.push_str(&format!(
                    "<span class=\"katex-inline\" data-expr=\"{}\"></span>",
                    html_escape(&expr)
                ));
                i = end + 1;
                continue;
            }
        }

        result.push(chars[i]);
        i += 1;
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frontmatter_extraction() {
        let content = "---\ntitle: Hello\n---\n# World";
        let (fm, body) = extract_frontmatter(content);
        assert_eq!(fm, Some("title: Hello".to_string()));
        assert!(body.contains("# World"));
    }

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Hello World"), "hello-world");
    }

    #[test]
    fn test_basic_render() {
        let (html, toc) = render_to_html("# Hello\n\nWorld");
        assert!(html.contains("Hello"));
        assert_eq!(toc.len(), 1);
        assert_eq!(toc[0].text, "Hello");
    }

    #[test]
    fn test_alert_render() {
        let (html, _) = render_to_html("> [!NOTE]\n> This is a note.");
        assert!(html.contains("markdown-alert-note"));
        assert!(html.contains("</div>"));
        // Must NOT contain </blockquote> for alerts
        assert!(!html.contains("</blockquote>"));
    }
}
