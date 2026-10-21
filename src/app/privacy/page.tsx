import Link from 'next/link'
import type { Metadata } from 'next'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — PEAC',
  description: 'How PEAC collects, uses and protects your information.',
}

const EFFECTIVE_DATE = 'October 21, 2026'
const CONTACT_EMAIL = 'bjvpeac@gmail.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <header className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-500 fill-blue-500" />
            <span className="text-lg font-bold">PEAC</span>
          </Link>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-zinc-400">Effective {EFFECTIVE_DATE}</p>
          <p className="text-sm leading-relaxed text-zinc-300">
            PEAC (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a training app that connects athletes with their
            performance coaches. This policy explains what information the PEAC app collects, how it is used, who can
            see it, and the choices you have.
          </p>
        </header>

        <Section title="Information we collect">
          <p><strong className="text-white">Account information.</strong> Your name, email address and password. Passwords are stored securely by our authentication provider and are never visible to us or your coach.</p>
          <p><strong className="text-white">Athlete profile.</strong> Information your coach or you add, such as sport, position and graduation year.</p>
          <p><strong className="text-white">Training information.</strong> The programs and workouts assigned to you, the weights and reps you log for each set, notes you add, warm-up items you check off, workout dates you move, and estimated maxes calculated from your logs.</p>
          <p><strong className="text-white">Strength and performance data.</strong> One-rep maxes and performance test results (for example sprint times or jump measurements) entered by you or your coach.</p>
          <p><strong className="text-white">Daily check-ins.</strong> If you complete check-ins, your self-reported sleep quality, energy, stress, soreness and motivation, plus any notes.</p>
          <p><strong className="text-white">Messages.</strong> Messages you send to or receive from your coach in the app.</p>
          <p><strong className="text-white">Technical information.</strong> Cookies needed to keep you signed in, and small settings stored on your device (such as whether the rest timer starts automatically). We do not use advertising or analytics trackers.</p>
        </Section>

        <Section title="How we use your information">
          <p>We use your information only to run the PEAC app: to show you your workouts and progress, let your coach plan and adjust your training, calculate personalized weights and progress charts, send account emails such as password resets, and keep the app secure.</p>
          <p>We do not sell your information, and we do not use it for advertising.</p>
        </Section>

        <Section title="Who can see your information">
          <p><strong className="text-white">Your coach</strong> can see your profile, training logs, check-ins, maxes, test results and messages with you, so they can coach you.</p>
          <p><strong className="text-white">PEAC administrators</strong> can access accounts to provide support, fix data entry mistakes, and manage coaches and athletes.</p>
          <p><strong className="text-white">Service providers</strong> who help us run the app process data on our behalf:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Supabase — database and sign-in</li>
            <li>Vercel — website hosting</li>
            <li>Google (Gmail) — sending account emails such as password resets</li>
            <li>YouTube — playing exercise demo videos. When you play a video, YouTube may collect information under Google&apos;s own privacy policy.</li>
          </ul>
          <p>We may also share information if required by law or to protect the safety of our users.</p>
        </Section>

        <Section title="Young athletes">
          <p>Many PEAC athletes are high school students. PEAC is not intended for children under 13, and we do not knowingly collect information from children under 13. If you believe a child under 13 has created an account, contact us and we will delete it. Parents or guardians of athletes under 18 may contact us to review or delete their athlete&apos;s information.</p>
        </Section>

        <Section title="How long we keep information">
          <p>We keep your information while your account is active. When an account is deleted, its information is permanently removed from the app, except copies that may remain briefly in backups.</p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white">Update</strong> your name and password in Settings.</li>
            <li><strong className="text-white">Delete your account</strong> at any time from Settings → Delete my account. This permanently removes your account and its data.</li>
            <li><strong className="text-white">Ask</strong> us for a copy of your information or for corrections by emailing us.</li>
          </ul>
        </Section>

        <Section title="Security">
          <p>Your information is stored with access controls so that only you, your coach and PEAC administrators can see it, and connections to the app are encrypted. No system is perfectly secure, but we work to protect your information.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>If we change this policy, we will update the effective date above and, for significant changes, let you know in the app.</p>
        </Section>

        <Section title="Contact us">
          <p>Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:text-blue-300">{CONTACT_EMAIL}</a></p>
        </Section>
      </div>
    </div>
  )
}
