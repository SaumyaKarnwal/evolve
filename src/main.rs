//! Thin CLI over the `evolve` library: find `~/.claude`, scan it, print the inventory.

use std::process::ExitCode;

fn main() -> ExitCode {
    // Resolve the real home directory (no hardcoded path).
    let Some(home) = dirs::home_dir() else {
        eprintln!("error: could not determine your home directory");
        return ExitCode::FAILURE;
    };
    let claude_root = home.join(".claude");

    let items = evolve::scan(&claude_root);
    print!("{}", evolve::render::render(&items));
    ExitCode::SUCCESS
}
