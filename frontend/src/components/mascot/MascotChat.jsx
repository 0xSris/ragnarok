import { motion, AnimatePresence } from 'framer-motion'
import MascotIdle from './MascotIdle'

const MESSAGES = {
  thinking: ["Hmm, let me check...", "Digging through your docs! 🔍", "On it, give me a sec! ✨"],
  success:  ["Found it! Here ya go 🎉", "Got the answer! ⚡", "Knowledge acquired! 🧠"],
  error:    ["Oops! Something broke 😬", "Uh oh, try again? 🫣"],
  upload:   ["Uploading... 📂", "Processing your files! 🔄", "Indexing knowledge! 🧩"],
  idle:     ["Ask me anything! 💬", "Your AI is ready! 🚀", "Drop some docs! 📄"],
}

export default function MascotChat({ state = 'idle', visible = true, message = null }) {
  const msgs = MESSAGES[state] || MESSAGES.idle
  const displayMsg = message || msgs[Math.floor(Math.random() * msgs.length)]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="flex flex-col items-center gap-2"
        >
          {/* Speech bubble */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative px-4 py-2 rounded-2xl text-sm font-medium text-primary-900 dark:text-primary-100 max-w-[180px] text-center bg-card border border-border shadow-subtle"
          >
            {displayMsg}
            {/* Triangle pointer */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-card"></div>
          </motion.div>

          <MascotIdle size={80} mood={state === 'thinking' ? 'thinking' : 'happy'} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
