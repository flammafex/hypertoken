// Utility functions for HyperToken Core

use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

/// Get current timestamp in milliseconds
pub fn now() -> i64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now() as i64
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
    }
}

/// Generate a unique ID (UUID v4)
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Create a deterministic RNG from a seed string
pub fn seeded_rng(seed: &str) -> ChaCha8Rng {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    seed.hash(&mut hasher);
    let hash = hasher.finish();

    // Convert to seed array
    let seed_array = [
        (hash & 0xFF) as u8,
        ((hash >> 8) & 0xFF) as u8,
        ((hash >> 16) & 0xFF) as u8,
        ((hash >> 24) & 0xFF) as u8,
        ((hash >> 32) & 0xFF) as u8,
        ((hash >> 40) & 0xFF) as u8,
        ((hash >> 48) & 0xFF) as u8,
        ((hash >> 56) & 0xFF) as u8,
        // Repeat for 32 bytes total
        (hash & 0xFF) as u8,
        ((hash >> 8) & 0xFF) as u8,
        ((hash >> 16) & 0xFF) as u8,
        ((hash >> 24) & 0xFF) as u8,
        ((hash >> 32) & 0xFF) as u8,
        ((hash >> 40) & 0xFF) as u8,
        ((hash >> 48) & 0xFF) as u8,
        ((hash >> 56) & 0xFF) as u8,
        (hash & 0xFF) as u8,
        ((hash >> 8) & 0xFF) as u8,
        ((hash >> 16) & 0xFF) as u8,
        ((hash >> 24) & 0xFF) as u8,
        ((hash >> 32) & 0xFF) as u8,
        ((hash >> 40) & 0xFF) as u8,
        ((hash >> 48) & 0xFF) as u8,
        ((hash >> 56) & 0xFF) as u8,
        (hash & 0xFF) as u8,
        ((hash >> 8) & 0xFF) as u8,
        ((hash >> 16) & 0xFF) as u8,
        ((hash >> 24) & 0xFF) as u8,
        ((hash >> 32) & 0xFF) as u8,
        ((hash >> 40) & 0xFF) as u8,
        ((hash >> 48) & 0xFF) as u8,
        ((hash >> 56) & 0xFF) as u8,
    ];

    ChaCha8Rng::from_seed(seed_array)
}

/// Fisher-Yates shuffle algorithm
pub fn shuffle_vec<T>(vec: &mut Vec<T>, seed: Option<&str>) {
    use rand::Rng;

    let len = vec.len();
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
        vec.swap(i, j);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seeded_rng_deterministic() {
        let mut vec1 = vec![1, 2, 3, 4, 5];
        let mut vec2 = vec![1, 2, 3, 4, 5];

        shuffle_vec(&mut vec1, Some("test-seed"));
        shuffle_vec(&mut vec2, Some("test-seed"));

        assert_eq!(vec1, vec2, "Seeded shuffle should be deterministic");
    }

    #[test]
    fn test_shuffle_changes_order() {
        let original = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let mut shuffled = original.clone();

        shuffle_vec(&mut shuffled, None);

        // Very unlikely to be the same after shuffle
        assert_ne!(original, shuffled);
    }

    #[test]
    fn test_shuffle_preserves_elements() {
        let original = vec![1, 2, 3, 4, 5];
        let mut shuffled = original.clone();

        shuffle_vec(&mut shuffled, None);

        let mut sorted = shuffled.clone();
        sorted.sort();

        assert_eq!(original, sorted, "Shuffle should preserve all elements");
    }
}
