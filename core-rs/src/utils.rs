// Utility functions for HyperToken Core

/// Deterministic PRNG (Mulberry32) replicating the TypeScript implementation
/// in `core/random.ts` exactly, so Rust shuffles produce the same orderings
/// as TypeScript for the same seed.
pub struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Mulberry32 { state: seed }
    }

    /// Next value in [0, 1), replicating TS `mulberry32` exactly using signed
    /// 32-bit wrapping semantics. The TS mix is:
    ///   t = (seed += 0x6D2B79F5) | 0;
    ///   t = Math.imul(t ^ (t >>> 15), t | 1);
    ///   t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    ///   return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    /// `>>>` is a LOGICAL shift on the unsigned interpretation, so in Rust we
    /// use `(t as u32 >> n) as i32`.
    pub fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6D2B79F5);
        let mut t = self.state as i32;
        t = (t ^ ((t as u32 >> 15) as i32)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ ((t as u32 >> 7) as i32)).wrapping_mul(t | 61));
        ((t ^ ((t as u32 >> 14) as i32)) as u32) as f64 / 4294967296.0
    }
}

/// Convert a seed string to a u32 mirroring JS `ToUint32` semantics: parse the
/// string as f64 (JS Number), truncate toward zero, mod 2^32. NaN/infinite/
/// unparseable strings become 0.
pub fn js_to_uint32(s: &str) -> u32 {
    match s.trim().parse::<f64>() {
        Ok(n) if n.is_finite() => {
            let truncated = n.trunc();
            (truncated as i64).wrapping_rem(1i64 << 32) as u32
        }
        _ => 0,
    }
}

/// Deterministic numeric hash for per-deck shuffle seeds ("{seed}-{idx}"),
/// replicating the TS `batchSeed` loop (charCodeAt is UTF-16).
pub(crate) fn batch_seed_hash(s: &str) -> u32 {
    let mut h: i32 = 0;
    for code in s.encode_utf16() {
        h = h.wrapping_shl(5).wrapping_sub(h).wrapping_add(code as i32);
    }
    h as u32
}

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

/// RNG source for shuffles: seeded (Mulberry32) or unseeded (thread_rng).
pub enum ShuffleRng {
    Seeded(Mulberry32),
    Unseeded(rand::rngs::ThreadRng),
}

impl ShuffleRng {
    /// Next value in [0, 1).
    pub fn next(&mut self) -> f64 {
        use rand::Rng;
        match self {
            ShuffleRng::Seeded(r) => r.next(),
            ShuffleRng::Unseeded(r) => r.gen_range(0.0..1.0),
        }
    }
}

/// Fisher-Yates shuffle algorithm
pub fn shuffle_vec<T>(vec: &mut Vec<T>, seed: Option<&str>) {
    let len = vec.len();
    if len <= 1 {
        return;
    }

    let mut rng = if let Some(seed_str) = seed {
        ShuffleRng::Seeded(Mulberry32::new(js_to_uint32(seed_str)))
    } else {
        ShuffleRng::Unseeded(rand::thread_rng())
    };

    for i in (1..len).rev() {
        let j = (rng.next() * (i + 1) as f64).floor() as usize;
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

    #[test]
    fn test_mulberry32_matches_ts_seed_123() {
        let mut rng = Mulberry32::new(123);
        let expected = [
            0.7872516233474016,
            0.1785435655619949,
            0.49531551403924823,
            0.23136196262203157,
            0.375791602069512,
        ];
        for e in expected {
            assert_eq!(rng.next(), e);
        }
    }

    #[test]
    fn test_mulberry32_matches_ts_seed_0() {
        let mut rng = Mulberry32::new(0);
        let expected = [
            0.26642920868471265,
            0.0003297457005828619,
            0.2232720274478197,
            0.1462021479383111,
            0.46732782293111086,
        ];
        for e in expected {
            assert_eq!(rng.next(), e);
        }
    }

    #[test]
    fn test_shuffle_vec_matches_ts_seed_123() {
        let mut v = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        shuffle_vec(&mut v, Some("123"));
        assert_eq!(v, vec![1, 7, 6, 10, 5, 3, 9, 4, 2, 8]);
    }

    #[test]
    fn test_shuffle_vec_matches_ts_seed_0() {
        let mut v = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        shuffle_vec(&mut v, Some("0"));
        assert_eq!(v, vec![4, 9, 7, 5, 6, 10, 8, 2, 1, 3]);
    }

    #[test]
    fn test_js_to_uint32() {
        assert_eq!(js_to_uint32("123"), 123);
        assert_eq!(js_to_uint32("0"), 0);
        assert_eq!(js_to_uint32("123.7"), 123);
        assert_eq!(js_to_uint32("-5"), 4294967291);
        assert_eq!(js_to_uint32("4294967296"), 0);
        assert_eq!(js_to_uint32("abc"), 0);
        assert_eq!(js_to_uint32(""), 0);
    }

    #[test]
    fn test_batch_seed_hash() {
        assert_eq!(batch_seed_hash("7-0"), 54298);
        assert_eq!(batch_seed_hash("7-1"), 54299);
    }
}
