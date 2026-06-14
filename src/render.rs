//! Human-readable rendering of a scanned inventory, grouped by scope.

use std::collections::BTreeMap;

use crate::model::{ScannedItem, Scope};

/// Render items grouped: Global first, then one section per project (sorted by dir name).
/// `&[ScannedItem]` is a borrowed slice — render only reads, never owns, the items.
pub fn render(items: &[ScannedItem]) -> String {
    if items.is_empty() {
        return "No items found. Is ~/.claude present?\n".to_string();
    }

    // Split into Global vs per-project. The map values hold *borrows* of the items (no copying);
    // the key is the section label (real path if resolved, else the encoded dir + a marker).
    let mut global: Vec<&ScannedItem> = Vec::new();
    let mut by_project: BTreeMap<String, Vec<&ScannedItem>> = BTreeMap::new();

    for item in items {
        match &item.scope {
            Scope::Global => global.push(item),
            Scope::Project { encoded, real_path } => {
                let label = match real_path {
                    Some(path) => path.clone(),
                    None => format!("{encoded}  (unresolved)"),
                };
                // entry(...).or_default() = "get this key's Vec, creating an empty one if absent".
                by_project.entry(label).or_default().push(item);
            }
        }
    }

    let mut out = format!("found {} items\n", items.len());
    if !global.is_empty() {
        out.push_str(&section("Global", &global));
    }
    for (dir, project_items) in &by_project {
        out.push_str(&section(dir, project_items));
    }
    out
}

/// One titled section: a header with a count, then each item as `kind  name`.
fn section(title: &str, items: &[&ScannedItem]) -> String {
    let mut s = format!("\n{title}  ({})\n", items.len());
    for item in items {
        // {:<8} = left-align in an 8-char column, so kinds line up.
        s.push_str(&format!("  {:<8} {}\n", item.kind.label(), item.name));
    }
    s
}
