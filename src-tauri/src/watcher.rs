use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

pub struct FileWatcher {
    _watcher: RecommendedWatcher,
    _thread: thread::JoinHandle<()>,
}

impl FileWatcher {
    pub fn new<F>(path: PathBuf, on_change: F) -> Result<Self, Box<dyn std::error::Error>>
    where
        F: Fn(&Event) + Send + 'static,
    {
        let (tx, rx) = mpsc::channel();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if event.kind.is_modify() || event.kind.is_create() {
                        let _ = tx.send(event);
                    }
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500)),
        )?;

        watcher.watch(&path, RecursiveMode::NonRecursive)?;

        let handle = thread::spawn(move || {
            // Debounce: only fire callback after 200ms of no events
            let debounce = Duration::from_millis(200);
            loop {
                match rx.recv() {
                    Ok(event) => {
                        // Drain any queued events within the debounce window
                        let mut last_event = event;
                        loop {
                            match rx.recv_timeout(debounce) {
                                Ok(e) => last_event = e,
                                Err(mpsc::RecvTimeoutError::Timeout) => break,
                                Err(mpsc::RecvTimeoutError::Disconnected) => return,
                            }
                        }
                        on_change(&last_event);
                    }
                    Err(_) => return,
                }
            }
        });

        Ok(FileWatcher {
            _watcher: watcher,
            _thread: handle,
        })
    }
}
