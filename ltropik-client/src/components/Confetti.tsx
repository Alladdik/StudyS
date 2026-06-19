import { motion } from 'framer-motion';

export function Confetti() {
  const pieces = Array.from({ length: 70 });
  const colors = ['#00c853', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#a855f7'];

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {pieces.map((_, i) => {
        const xStart = Math.random() * 100;
        const xOffset = Math.random() * 30 - 15;
        const duration = 2.5 + Math.random() * 2;
        const delay = Math.random() * 0.7;
        const size = 6 + Math.random() * 8;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const rotation = 360 + Math.random() * 720;
        
        return (
          <motion.div
            key={i}
            initial={{
              top: '-10%',
              left: `${xStart}%`,
              scale: 0.5 + Math.random() * 0.8,
              rotate: 0,
              opacity: 0.8,
            }}
            animate={{
              top: '110%',
              left: `${xStart + xOffset}%`,
              rotate: rotation,
              opacity: 0,
            }}
            transition={{
              duration,
              delay,
              ease: 'linear',
            }}
            className="absolute rounded-sm shadow-sm"
            style={{
              width: size,
              height: size,
              backgroundColor: color,
            }}
          />
        );
      })}
    </div>
  );
}
