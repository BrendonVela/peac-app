import Link from 'next/link'
import type { Metadata } from 'next'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — PEAC',
  description: 'How PEAC collects, uses, shares and protects your information, and the choices you have.',
}

// ---- Edit these if your details change ----
const APP_NAME = 'PEAC'
const OPERATOR = 'Brendon Vela'
const EFFECTIVE_DATE = 'October 21, 2026'
const CONTACT_EMAIL = 'bjvpeac@gmail.com'
const SITE_URL = 'https://peac-app.vercel.app'
// -------------------------------------------

const SECTIONS = [
  ['summary', 'The short version'],
  ['who', 'Who we are'],
  ['collect', 'Information we collect'],
  ['use', 'How we use information'],
  ['health', 'Health and wellness information'],
  ['share', 'Who can see and receive your information'],
  ['cookies', 'Cookies and device storage'],
  ['minors', 'Children and teen athletes'],
  ['retention', 'How long we keep information'],
  ['delete', 'Deleting your account'],
  ['rights', 'Your privacy rights'],
  ['security', 'Security'],
  ['transfers', 'Where information is processed'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact us'],
] as const

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold text-white">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  )
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-white">{children}</strong>
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:text-blue-300">
      {CONTACT_EMAIL}
    </a>
  )
}

const DATA_ROWS: [string, string, string][] = [
  ['Account', 'Name, email address, password (stored only as a secure hash), account role (coach or athlete)', 'You'],
  ['Athlete profile', 'Sport, position, graduation year, which coach you are connected to', 'You or your coach'],
  ['Training', 'Assigned programs and workouts, workout dates and schedule changes, weights and reps logged for each set, workout notes, warm-up items checked off, completion status', 'You and your coach'],
  ['Strength and performance', 'One-rep maxes, estimated maxes calculated from your logs, test results such as sprint times, jumps, agility times and body weight', 'You, your coach, or calculated by the app'],
  ['Daily check-ins', 'Self-rated sleep quality, energy, stress, soreness and motivation, a readiness score calculated from them, and optional notes', 'You'],
  ['Messages', 'Messages between you and your coach in the app', 'You and your coach'],
  ['Technical', 'Sign-in session cookies, basic server and security logs kept by our hosting providers (such as IP address, browser type and request time)', 'Collected automatically'],
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
        <header className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <Zap className="h-6 w-6 fill-blue-500 text-blue-500" />
            <span className="text-lg font-bold">{APP_NAME}</span>
          </Link>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-zinc-400">Effective and last updated {EFFECTIVE_DATE}</p>
          <p className="text-sm leading-relaxed text-zinc-300">
            This policy explains how {APP_NAME} collects, uses, shares and protects information when you use the{' '}
            {APP_NAME} website and app at {SITE_URL} and any {APP_NAME} mobile app (together, the &ldquo;Service&rdquo;).
            By using the Service, you agree to the practices described here.
          </p>
        </header>

        <nav className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Contents</p>
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {SECTIONS.map(([id, title], i) => (
              <li key={id}>
                <a href={`#${id}`} className="text-zinc-300 hover:text-blue-400">
                  {i + 1}. {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="summary" n={1} title="The short version">
          <ul className="list-disc space-y-1 pl-5">
            <li>We collect the information needed to run your training: your account, workouts, logs, check-ins, test results and messages.</li>
            <li>Your coach can see your training information. {APP_NAME} administrators can access accounts for support.</li>
            <li>We <B>do not sell</B> your information, <B>do not show ads</B>, and <B>do not use tracking or advertising cookies</B>.</li>
            <li>You can delete your account and its data at any time from <B>Settings → Delete my account</B>.</li>
            <li>The Service is not for children under 13.</li>
          </ul>
        </Section>

        <Section id="who" n={2} title="Who we are">
          <p>
            {APP_NAME} is a strength and performance training app operated by {OPERATOR} in the United States
            (&ldquo;{APP_NAME}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). We are responsible for the information described in
            this policy. You can reach us at <Mail />.
          </p>
          <p>
            Coaches who use {APP_NAME} decide which athletes to invite and what training to assign. When a coach enters
            information about an athlete, the coach is also responsible for having the right to share it.
          </p>
        </Section>

        <Section id="collect" n={3} title="Information we collect">
          <p>We collect only what the Service needs to work:</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Examples</th>
                  <th className="px-3 py-2">Comes from</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {DATA_ROWS.map(([cat, ex, src]) => (
                  <tr key={cat} className="align-top">
                    <td className="px-3 py-2 font-medium text-white">{cat}</td>
                    <td className="px-3 py-2">{ex}</td>
                    <td className="px-3 py-2 text-zinc-400">{src}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            We do <B>not</B> collect your precise location, contacts, photos, payment information, or information from
            your device&apos;s health apps, and we do not use advertising identifiers.
          </p>
        </Section>

        <Section id="use" n={4} title="How we use information">
          <ul className="list-disc space-y-1 pl-5">
            <li><B>Provide the Service</B> — show your workouts and schedule, record your sets, calculate personalized weights, estimated maxes, progress charts and personal records.</li>
            <li><B>Support coaching</B> — let your coach plan, review and adjust your training and communicate with you.</li>
            <li><B>Account emails</B> — send invitations, password resets and other messages about your account. We do not send marketing emails.</li>
            <li><B>Support and fixes</B> — help you with problems and correct data entry mistakes when asked.</li>
            <li><B>Safety and security</B> — protect accounts, prevent misuse and comply with the law.</li>
          </ul>
          <p>
            We do not use your information for advertising, we do not sell it, and we do not use it to make automated
            decisions that have legal or similarly significant effects on you.
          </p>
          <p>
            If you are in the European Economic Area or the United Kingdom, we rely on these legal bases: performing our
            agreement with you to provide the Service; our legitimate interests in operating, supporting and securing the
            Service; your consent for daily check-in information; and compliance with legal obligations.
          </p>
        </Section>

        <Section id="health" n={5} title="Health and wellness information">
          <p>
            Daily check-ins (sleep, energy, stress, soreness, motivation), body weight and performance results may be
            considered health information under some laws. We treat them with extra care:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Check-ins are optional. By submitting one, you consent to its collection for the purposes below.</li>
            <li>We use this information only to help you and your coach manage training, recovery and readiness.</li>
            <li>It is shared only with your coach, {APP_NAME} administrators and the service providers that host it. It is never sold or used for advertising.</li>
            <li>You can withdraw consent by no longer submitting check-ins, and you can ask us to delete past check-ins or delete your account at any time.</li>
          </ul>
          <p>
            {APP_NAME} is a training tool, not a medical service. It does not diagnose, treat or monitor any medical
            condition. Talk to a qualified professional about injuries or health concerns.
          </p>
        </Section>

        <Section id="share" n={6} title="Who can see and receive your information">
          <p><B>Your coach.</B> If you are an athlete, the coach you are connected to can see your profile, training logs, check-ins, maxes, test results and your messages with them. Other athletes cannot see your information.</p>
          <p><B>{APP_NAME} administrators.</B> A small number of administrators can view and manage accounts to provide support, fix mistakes, move athletes between coaches, and remove accounts.</p>
          <p><B>Service providers.</B> These companies process information on our behalf, only to provide their services to us:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><B>Supabase</B> — database, file storage and sign-in</li>
            <li><B>Vercel</B> — website hosting and delivery</li>
            <li><B>Google (Gmail)</B> — sending account emails such as invitations and password resets</li>
            <li>
              <B>YouTube (Google)</B> — exercise demo videos are embedded from YouTube. When you play a video, YouTube may
              collect information under the{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Google Privacy Policy</a>.
            </li>
          </ul>
          <p><B>Legal and safety.</B> We may disclose information if required by law, subpoena or court order, or when we believe in good faith it is necessary to protect the safety, rights or property of anyone.</p>
          <p><B>Business changes.</B> If {APP_NAME} is transferred to a new owner, your information may be transferred as part of that change, and this policy will continue to apply to it unless you are notified otherwise.</p>
          <p>
            We do not sell personal information, and we do not &ldquo;share&rdquo; it for cross-context behavioral
            advertising as those terms are defined under California law.
          </p>
        </Section>

        <Section id="cookies" n={7} title="Cookies and device storage">
          <p>We use only what is needed for the Service to work:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><B>Sign-in cookies</B> that keep you logged in securely.</li>
            <li><B>An administrator cookie</B> used only when an administrator is viewing an account for support.</li>
            <li><B>Device storage</B> for small preferences, such as whether the rest timer starts automatically. This stays on your device.</li>
          </ul>
          <p>
            We do not use analytics, advertising or cross-site tracking cookies. Because we do not track you across
            sites, we do not respond differently to &ldquo;Do Not Track&rdquo; signals.
          </p>
        </Section>

        <Section id="minors" n={8} title="Children and teen athletes">
          <p>
            The Service is <B>not intended for children under 13</B>, and we do not knowingly collect personal information
            from them. If we learn that a child under 13 has an account, we will delete it. If you believe this has
            happened, contact us at <Mail />.
          </p>
          <p>
            Many athletes are high school students aged 13 to 17. Athletes under 18 should use {APP_NAME} with the knowledge
            of a parent or guardian and with a coach their family knows. A parent or guardian may contact us to review,
            correct or delete their athlete&apos;s information.
          </p>
        </Section>

        <Section id="retention" n={9} title="How long we keep information">
          <ul className="list-disc space-y-1 pl-5">
            <li>We keep account and training information <B>while your account is active</B>, so you and your coach can see your history and progress.</li>
            <li>When an account is deleted, its information is removed from the Service <B>right away</B>. Copies in our providers&apos; backups are overwritten on their normal schedule, generally within 30 days.</li>
            <li>Basic security logs kept by our hosting providers are retained for a limited period under their own policies.</li>
            <li>We may keep limited information longer if the law requires it or to resolve disputes.</li>
          </ul>
        </Section>

        <Section id="delete" n={10} title="Deleting your account">
          <p>You can delete your account yourself at any time:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Sign in and open <B>Settings</B>.</li>
            <li>Tap <B>Delete my account</B> and confirm.</li>
          </ol>
          <p>
            Deleting an <B>athlete</B> account permanently removes that athlete&apos;s profile, logged sets, check-ins, maxes,
            test results, schedule and messages. Deleting a <B>coach</B> account removes the coach&apos;s profile and
            programs; that coach&apos;s athletes keep their own accounts and become unassigned.
          </p>
          <p>
            If you cannot sign in, email <Mail /> from the address on your account and we will delete it for you.
          </p>
        </Section>

        <Section id="rights" n={11} title="Your privacy rights">
          <p>Wherever you live, you can ask us to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><B>Access</B> the personal information we hold about you and receive a copy in a portable format;</li>
            <li><B>Correct</B> information that is wrong;</li>
            <li><B>Delete</B> your information;</li>
            <li><B>Withdraw consent</B> where we rely on it, such as for check-ins.</li>
          </ul>
          <p>
            Depending on where you live (for example California, Colorado, Connecticut, Virginia, Washington, other U.S.
            states, the EEA or the UK), you may have additional rights, such as the right to restrict or object to
            certain processing, the right to appeal our decision on your request, and the right to complain to your
            local data protection or consumer protection authority. We will not discriminate against you for using your
            rights.
          </p>
          <p>
            To make a request, email <Mail />. We may need to confirm your identity by verifying the email address on your
            account. An authorized agent or parent may make a request for you. We will respond within the time the law
            requires, generally within 30 to 45 days. If we deny your request, you may appeal by replying to our
            response, and we will explain the outcome.
          </p>
        </Section>

        <Section id="security" n={12} title="Security">
          <ul className="list-disc space-y-1 pl-5">
            <li>All connections to the Service are encrypted with HTTPS.</li>
            <li>Information is stored with our database provider, which encrypts data at rest.</li>
            <li>Passwords are stored only as secure hashes. We and your coach can never see them.</li>
            <li>Database access rules limit each person to the information they are allowed to see.</li>
          </ul>
          <p>
            No method of storage or transmission is 100% secure. If a security incident affects your personal
            information, we will notify you and the authorities as required by law. Please use a strong, unique
            password and tell us right away if you think your account has been compromised.
          </p>
        </Section>

        <Section id="transfers" n={13} title="Where information is processed">
          <p>
            {APP_NAME} is based in the United States. Your information is processed in the United States and in other
            countries where our service providers operate. Where the law requires, we rely on appropriate safeguards,
            such as our providers&apos; standard contractual clauses, for transfers from the EEA or UK.
          </p>
        </Section>

        <Section id="changes" n={14} title="Changes to this policy">
          <p>
            We may update this policy as the Service changes. We will update the date at the top, and if a change is
            significant we will notify you in the app or by email before it takes effect.
          </p>
        </Section>

        <Section id="contact" n={15} title="Contact us">
          <p>For questions, requests or concerns about privacy:</p>
          <p>
            {APP_NAME} — {OPERATOR}
            <br />
            Email: <Mail />
          </p>
        </Section>

        <footer className="border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          <Link href="/login" className="hover:text-zinc-300">← Back to {APP_NAME}</Link>
        </footer>
      </div>
    </div>
  )
}
