import { motion } from 'framer-motion'

// Cute robot/wizard mascot built purely with SVG + framer-motion
export default function MascotIdle({ size = 100, mood = 'happy' }) {
  const eyeY = mood === 'thinking' ? 38 : 36
  const mouthPath = mood === 'happy'
    ? 'M 32 50 Q 40 57 48 50'
    : mood === 'thinking'
    ? 'M 33 50 Q 40 50 47 50'
    : 'M 32 50 Q 40 57 48 50'

  return (
    <motion.div
      style={{ width: size, height: size }}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        {/* Hat */}
        <motion.g
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '40px', originY: '15px' }}
        >
          <ellipse cx="40" cy="22" rx="22" ry="5" fill="#6b7280" />
          <polygon points="40,2 28,22 52,22" fill="#4b5563" />
          <polygon points="40,2 34,22 46,22" fill="#374151" />
        </motion.g>

        {/* Body / head */}
        <rect x="18" y="20" width="44" height="50" rx="16" fill="#9ca3af" />
        <rect x="21" y="23" width="38" height="44" rx="13" fill="#d1d5db" />

        {/* Screen / face area */}
        <rect x="25" y="28" width="30" height="28" rx="8" fill="#1f2937" />

        {/* Eyes */}
        <motion.circle
          cx="33" cy={eyeY}
          r="4.5"
          fill="#e5e7eb"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 3 }}
        />
        <motion.circle
          cx="47" cy={eyeY}
          r="4.5"
          fill="#e5e7eb"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, delay: 0.5 }}
        />

        {/* Mouth */}
        <path d={mouthPath} stroke="#e5e7eb" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Eye gleam */}
        <circle cx="35" cy={eyeY - 1.5} r="1.2" fill="white" opacity="0.8" />
        <circle cx="49" cy={eyeY - 1.5} r="1.2" fill="white" opacity="0.8" />

        {/* Mouth */}
        <motion.path
          d={mouthPath}
          stroke="#00f5ff"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          animate={{ d: [mouthPath, mouthPath] }}
        />

        {/* Cheek blush */}
        <circle cx="26" cy="46" r="4" fill="#ff2d78" opacity="0.4" />
        <circle cx="54" cy="46" r="4" fill="#ff2d78" opacity="0.4" />

        {/* Body bottom */}
        <rect x="22" y="62" width="36" height="10" rx="6" fill="#c026d3" />

        {/* Arms */}
        <motion.rect
          x="8" y="50" width="12" height="7" rx="4"
          fill="#d946ef"
          animate={{ rotate: [-15, 15, -15] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '18px', originY: '54px' }}
        />
        <motion.rect
          x="60" y="50" width="12" height="7" rx="4"
          fill="#d946ef"
          animate={{ rotate: [15, -15, 15] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '62px', originY: '54px' }}
        />

        {/* Feet */}
        <ellipse cx="32" cy="77" rx="8" ry="5" fill="#7c3aed" />
        <ellipse cx="48" cy="77" rx="8" ry="5" fill="#7c3aed" />

        {/* Sparkles */}
        <motion.text x="60" y="32" fontSize="10"
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        >✨</motion.text>
        <motion.text x="5" y="42" fontSize="8"
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.2 }}
        >⭐</motion.text>
      </svg>
    </motion.div>
  )
}
