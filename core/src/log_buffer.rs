//! Byte and line bounds apply across all game sessions, not just one instance.
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Default)]
pub(crate) struct LogBuffer {
    entries: HashMap<String, VecDeque<String>>,
    order: VecDeque<String>,
    bytes: usize,
    omitted: HashSet<String>,
}
impl LogBuffer {
    pub fn push(&mut self, id: &str, line: String) {
        self.order.retain(|key| key != id);
        self.order.push_back(id.into());
        self.bytes += line.len();
        let lines = self.entries.entry(id.into()).or_default();
        lines.push_back(line);
        while lines.len() > 2000 {
            self.bytes -= lines.pop_front().unwrap().len();
            self.omitted.insert(id.into());
        }
        while self.bytes > 16 * 1024 * 1024 {
            let oldest = self.order.front().cloned().unwrap();
            if oldest == id {
                if let Some(line) = self.entries.get_mut(id).and_then(VecDeque::pop_front) {
                    self.bytes -= line.len();
                    self.omitted.insert(id.into());
                } else {
                    break;
                }
            } else {
                self.remove(&oldest);
                self.omitted.insert(oldest);
            }
        }
    }
    pub fn get(&self, id: &str) -> Vec<String> {
        let mut lines: Vec<String> = self
            .entries
            .get(id)
            .map(|lines| lines.iter().cloned().collect())
            .unwrap_or_default();
        if self.omitted.contains(id) {
            if lines.len() == 2000 {
                lines.remove(0);
            }
            lines.insert(0, "Earlier logs omitted.".into());
        }
        lines
    }
    pub fn remove(&mut self, id: &str) {
        self.omitted.remove(id);
        if let Some(lines) = self.entries.remove(id) {
            self.bytes -= lines.iter().map(String::len).sum::<usize>();
        }
        self.order.retain(|key| key != id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn retention_is_bounded_across_sessions() {
        let mut logs = LogBuffer::default();
        for n in 0..3000 {
            logs.push("active", n.to_string());
        }
        assert_eq!(logs.get("active").len(), 2000);
        for n in 0..4 {
            for _ in 0..2000 {
                logs.push(&n.to_string(), "x".repeat(8192));
            }
        }
        assert!(logs.bytes <= 16 * 1024 * 1024);
        assert!(!logs.get("3").is_empty());
    }
}
