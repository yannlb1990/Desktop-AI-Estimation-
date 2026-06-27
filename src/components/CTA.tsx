import { motion } from "framer-motion";
import { isSignedIn } from "@/lib/localAuth";

const CTA = () => {
  const words1 = ["Price", "the", "job."];
  const words2 = ["Get", "home", "for", "dinner."];

  return (
    <section className="relative py-32 md:py-40 bg-background overflow-hidden">

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[700px] h-[400px] bg-[#E1DCC9]/4 blur-[120px] rounded-full" />
      </div>

      <div className="container mx-auto px-6 lg:px-12 relative z-10 text-center">

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 mb-10"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#E1DCC9] animate-pulse" />
          <span className="text-xs font-mono text-[#E1DCC9]/60 uppercase tracking-widest">
            Start today
          </span>
        </motion.div>

        <h2
          className="font-display font-bold text-white leading-[0.9] tracking-tight mb-8 mx-auto"
          style={{ fontSize: "clamp(2.75rem, 7vw, 6rem)", maxWidth: "16ch" }}
        >
          <span className="flex flex-wrap justify-center gap-x-[0.25em]">
            {words1.map((word, i) => (
              <motion.span
                key={word + i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.25, 0, 0.2, 1] }}
              >
                {word}
              </motion.span>
            ))}
          </span>
          <span className="flex flex-wrap justify-center gap-x-[0.25em] text-white/25 mt-1">
            {words2.map((word, i) => (
              <motion.span
                key={word + i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: [0.25, 0, 0.2, 1] }}
              >
                {word}
              </motion.span>
            ))}
          </span>
        </h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-white/40 text-base max-w-sm mx-auto mb-12 leading-relaxed"
        >
          Builders spend hours writing up quotes by hand every week.
          Metricore turns that into 30 minutes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.location.href = isSignedIn() ? "/dashboard" : "/auth?plan=pro&mode=signup"}
            className="inline-flex items-center px-9 py-5 rounded-full bg-primary text-black font-bold text-base hover:bg-[#d4cfb5] transition-colors shadow-none hover:shadow-none"
          >
            Start free for 14 days
          </motion.button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.75 }}
          className="mt-7 text-[11px] font-mono text-white/20 tracking-widest uppercase"
        >
          No credit card · Full access · Cancel anytime · From $79/month
        </motion.p>

      </div>
    </section>
  );
};

export default CTA;
