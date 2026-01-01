// Parallel and batch operations for HyperToken Core
//
// Phase 3B: Rust Parallelization
//
// Note: While Rayon doesn't work directly in WASM (no native threads yet),
// this module provides:
// 1. Batch operations for efficient processing
// 2. Optimized algorithms that leverage LLVM auto-vectorization
// 3. Future-ready architecture for when WASM threads stabilize
//
// Performance targets:
// - Batch shuffle (1000 tokens): Additional 2-4x improvement
// - Parallel zone operations: 2-3x improvement
// - Combined with Node.js workers: 8-32x total speedup

use rand::Rng;
use crate::utils::seeded_rng;

/// Batch shuffle multiple independent decks
///
/// This optimizes for cache locality and reduces overhead
/// by processing multiple shuffle operations together.
///
/// In WASM: Uses optimized sequential processing
/// In native: Could use Rayon for true parallelism
pub fn batch_shuffle<T: Clone + Send>(
    decks: &mut [Vec<T>],
    seed_prefix: Option<&str>,
) {
    #[cfg(not(target_arch = "wasm32"))]
    {
        // Native: Use Rayon for parallel processing
        use rayon::prelude::*;

        decks.par_iter_mut().enumerate().for_each(|(idx, deck)| {
            let seed = seed_prefix.map(|s| format!("{}-{}", s, idx));
            shuffle_single(deck, seed.as_deref());
        });
    }

    #[cfg(target_arch = "wasm32")]
    {
        // WASM: Sequential but optimized
        for (idx, deck) in decks.iter_mut().enumerate() {
            let seed = seed_prefix.map(|s| format!("{}-{}", s, idx));
            shuffle_single(deck, seed.as_deref());
        }
    }
}

/// Optimized Fisher-Yates shuffle for a single deck
fn shuffle_single<T>(deck: &mut Vec<T>, seed: Option<&str>) {
    let len = deck.len();
    if len <= 1 {
        return;
    }

    let mut rng: Box<dyn rand::RngCore> = if let Some(seed_str) = seed {
        Box::new(seeded_rng(seed_str))
    } else {
        Box::new(rand::thread_rng())
    };

    for i in (1..len).rev() {
        let j = rng.gen_range(0..=i);
        deck.swap(i, j);
    }
}

/// Batch draw operations across multiple decks
///
/// Efficiently processes multiple draw operations in one pass,
/// improving cache utilization.
pub fn batch_draw<T: Clone>(
    decks: &mut [Vec<T>],
    counts: &[usize],
) -> Vec<Vec<T>> {
    assert_eq!(decks.len(), counts.len(), "Deck and count arrays must match");

    let mut results = Vec::with_capacity(decks.len());

    for (deck, &count) in decks.iter_mut().zip(counts.iter()) {
        let available = deck.len();
        let to_draw = count.min(available);

        let drawn: Vec<T> = deck
            .drain(deck.len() - to_draw..)
            .rev()
            .collect();

        results.push(drawn);
    }

    results
}

/// Parallel map operation on token collections
///
/// Applies a transformation function to all tokens efficiently.
/// Uses SIMD-friendly iteration patterns for LLVM optimization.
#[inline]
pub fn parallel_map<T, F, U>(items: &[T], f: F) -> Vec<U>
where
    T: Sync,
    F: Fn(&T) -> U + Sync + Send,
    U: Send,
{
    #[cfg(not(target_arch = "wasm32"))]
    {
        // Native: Use Rayon
        use rayon::prelude::*;
        items.par_iter().map(f).collect()
    }

    #[cfg(target_arch = "wasm32")]
    {
        // WASM: Sequential but LLVM-optimized
        items.iter().map(f).collect()
    }
}

/// Parallel filter operation
///
/// Filters tokens based on a predicate efficiently.
#[inline]
pub fn parallel_filter<T, F>(items: &[T], predicate: F) -> Vec<T>
where
    T: Clone + Sync + Send,
    F: Fn(&T) -> bool + Sync + Send,
{
    #[cfg(not(target_arch = "wasm32"))]
    {
        use rayon::prelude::*;
        items.par_iter().filter(|item| predicate(item)).cloned().collect()
    }

    #[cfg(target_arch = "wasm32")]
    {
        items.iter().filter(|item| predicate(item)).cloned().collect()
    }
}

/// Chunked processing for large datasets
///
/// Processes data in cache-friendly chunks for better performance.
pub struct ChunkedIterator<T> {
    data: Vec<T>,
    chunk_size: usize,
}

impl<T> ChunkedIterator<T> {
    pub fn new(data: Vec<T>, chunk_size: usize) -> Self {
        Self { data, chunk_size }
    }

    pub fn process<F, R>(&mut self, mut processor: F) -> Vec<R>
    where
        F: FnMut(&[T]) -> R,
    {
        self.data
            .chunks(self.chunk_size)
            .map(|chunk| processor(chunk))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_shuffle() {
        let mut decks = vec![
            vec![1, 2, 3, 4, 5],
            vec![10, 20, 30, 40, 50],
            vec![100, 200, 300, 400, 500],
        ];

        batch_shuffle(&mut decks, Some("test"));

        // Check all elements preserved
        let mut deck1_sorted = decks[0].clone();
        deck1_sorted.sort();
        assert_eq!(deck1_sorted, vec![1, 2, 3, 4, 5]);

        let mut deck2_sorted = decks[1].clone();
        deck2_sorted.sort();
        assert_eq!(deck2_sorted, vec![10, 20, 30, 40, 50]);
    }

    #[test]
    fn test_batch_draw() {
        let mut decks = vec![
            vec![1, 2, 3, 4, 5],
            vec![10, 20, 30, 40, 50],
        ];

        let results = batch_draw(&mut decks, &[2, 3]);

        assert_eq!(results[0].len(), 2);
        assert_eq!(results[1].len(), 3);
        assert_eq!(decks[0].len(), 3);
        assert_eq!(decks[1].len(), 2);
    }

    #[test]
    fn test_parallel_map() {
        let items = vec![1, 2, 3, 4, 5];
        let results = parallel_map(&items, |x| x * 2);
        assert_eq!(results, vec![2, 4, 6, 8, 10]);
    }

    #[test]
    fn test_parallel_filter() {
        let items = vec![1, 2, 3, 4, 5, 6];
        let results = parallel_filter(&items, |x| x % 2 == 0);
        assert_eq!(results, vec![2, 4, 6]);
    }

    #[test]
    fn test_chunked_iterator() {
        let data = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let mut chunked = ChunkedIterator::new(data, 3);

        let sums = chunked.process(|chunk| chunk.iter().sum::<i32>());

        // Chunks: [1,2,3], [4,5,6], [7,8,9], [10]
        assert_eq!(sums, vec![6, 15, 24, 10]);
    }
}
