import Link from 'next/link'
import type { Metadata } from 'next'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service — PEAC',
  description: 'The rules for using PEAC.',
}

// ---- Edit these if your details change ----
const APP_NAME = 'PEAC'
const OPERATOR = 'Brendon Vela'
const EFFECTIVE_DATE = 'October 21, 2026'
const CONTACT_EMAIL = 'bjvpeac@gmail.com'
// -------------------------------------------

const SECTIONS = [
  ['agree', 'Agreeing to these terms'],
  ['eligibility', 'Who can use PEAC'],
  ['accounts', 'Your account'],
  ['coaches', 'Coaches and athletes'],
  ['health', 'Training and health risks'],
  ['content', 'Your content'],
  ['acceptable', 'Acceptable use'],
  ['ours', 'Our content and videos'],
  ['availability', 'Changes and availability'],
  ['ending', 'Ending your use'],
  ['disclaimers', 'Disclaimers'],
  ['liability', 'Limitation of liability'],
  ['indemnity', 'Indemnity'],
  ['law', 'Disputes and governing law'],
  ['apple', 'App store terms'],
  ['changes', 'Changes to these terms'],
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
        <header className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <Zap className="h-6 w-6 fill-blue-500 text-blue-500" />
            <span className="text-lg font-bold">{APP_NAME}</span>
          </Link>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-sm text-zinc-400">Effective and last updated {EFFECTIVE_DATE}</p>
          <p className="text-sm leading-relaxed text-zinc-300">
            These terms are an agreement between you and {APP_NAME}, operated by {OPERATOR} (&ldquo;{APP_NAME}&rdquo;,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;), for your use of the {APP_NAME} website and apps (the &ldquo;Service&rdquo;).
            Please read them together with our{' '}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>.
          </p>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
            <B>Important:</B> Strength and speed training carries a risk of injury. {APP_NAME} is a training tool, not
            medical advice. Check with a doctor before starting a new program, and stop if you feel pain. See section 5.
          </div>
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

        <Section id="agree" n={1} title="Agreeing to these terms">
          <p>
            By creating an account or using the Service, you agree to these terms. If you do not agree, do not use the
            Service. If you use the Service for a team, school or business, you confirm you are allowed to accept these
            terms for it.
          </p>
        </Section>

        <Section id="eligibility" n={2} title="Who can use PEAC">
          <ul className="list-disc space-y-1 pl-5">
            <li>You must be <B>at least 13 years old</B>.</li>
            <li>If you are under 18, you may use the Service only with the permission of a parent or guardian, who agrees to these terms for you.</li>
            <li>Coaches must be at least 18 and are responsible for following the rules of any school, club or league they coach for.</li>
          </ul>
        </Section>

        <Section id="accounts" n={3} title="Your account">
          <ul className="list-disc space-y-1 pl-5">
            <li>Give accurate information and keep it up to date.</li>
            <li>Keep your password private. You are responsible for activity on your account.</li>
            <li>Tell us right away at <Mail /> if you think someone else is using your account.</li>
            <li>One person per account. Do not share or sell accounts.</li>
          </ul>
        </Section>

        <Section id="coaches" n={4} title="Coaches and athletes">
          <p>
            {APP_NAME} connects athletes with their coaches. <B>Coaches</B> create programs, assign training, set weights and
            can see their athletes&apos; training information, check-ins and messages. <B>Athletes</B> follow the training
            their coach assigns and log their results.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Coaches are independent and are solely responsible for the training they design and assign, and for supervising their athletes appropriately.</li>
            <li>Coaches must only invite athletes they actually coach, and must have permission (including a parent&apos;s permission for minors) to add athletes and their information.</li>
            <li>{APP_NAME} administrators may access accounts to provide support, fix mistakes, move athletes between coaches and remove accounts, as described in the Privacy Policy.</li>
          </ul>
        </Section>

        <Section id="health" n={5} title="Training and health risks">
          <p>
            The Service, including workouts, suggested weights, percentages, rest times, readiness scores and demo videos,
            is provided for general training purposes only. It is <B>not medical advice</B> and does not replace a
            doctor, physical therapist or certified professional.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Get medical clearance before beginning a new training program, especially if you have an injury or health condition.</li>
            <li>Use proper technique, warm up, and use spotters and safety equipment where appropriate.</li>
            <li>Suggested weights are calculated automatically and may not be right for you on a given day. Adjust them to what you can perform safely.</li>
            <li><B>Stop immediately</B> and seek help if you feel pain, dizziness, shortness of breath or other warning signs.</li>
          </ul>
          <p>
            You understand that physical training involves an inherent risk of injury, and you choose to participate
            voluntarily and at your own risk, to the fullest extent the law allows.
          </p>
        </Section>

        <Section id="content" n={6} title="Your content">
          <p>
            &ldquo;Your content&rdquo; means things you put into the Service, such as logged sets, notes, check-ins,
            messages, and programs or exercises a coach creates. You keep ownership of your content. You give {APP_NAME} a
            limited permission to store, copy, display and process your content only as needed to operate and improve the
            Service and as described in the Privacy Policy. This permission ends when your content is deleted, except
            for backup copies that are removed on their normal schedule.
          </p>
          <p>You confirm you have the right to post your content and that it does not break any law or anyone else&apos;s rights.</p>
        </Section>

        <Section id="acceptable" n={7} title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>harass, threaten, bully or send inappropriate messages to anyone, especially minors;</li>
            <li>post content that is unlawful, sexual, hateful, violent or that violates someone&apos;s privacy or rights;</li>
            <li>access accounts or data you are not allowed to see, or try to get around security or access limits;</li>
            <li>interfere with, overload, scrape, copy or reverse engineer the Service;</li>
            <li>use the Service for anything illegal or to impersonate someone else.</li>
          </ul>
          <p>To report a problem or misuse, email <Mail />.</p>
        </Section>

        <Section id="ours" n={8} title="Our content and videos">
          <p>
            The Service, including its design, software, exercise library and branding, belongs to {APP_NAME} and its
            licensors and is protected by law. We give you a personal, non-transferable, revocable permission to use the
            Service for its intended purpose while you follow these terms.
          </p>
          <p>
            Exercise videos are played from YouTube and are subject to YouTube&apos;s own terms. Links to other sites are
            provided for convenience, and we are not responsible for their content.
          </p>
        </Section>

        <Section id="availability" n={9} title="Changes and availability">
          <p>
            We are always improving {APP_NAME}, so features may be added, changed or removed. We try to keep the Service
            running smoothly, but it may sometimes be unavailable, and we do not guarantee it will always work without
            interruption or errors. Keep your own records of anything important.
          </p>
          <p>The Service is currently provided free of charge. If we ever introduce paid features, we will tell you the price and terms before you are charged.</p>
        </Section>

        <Section id="ending" n={10} title="Ending your use">
          <p>
            You can stop using the Service and delete your account at any time from <B>Settings → Delete my account</B>.
            We may suspend or close an account that breaks these terms, puts others at risk, or that we must close by
            law. Where reasonable, we will tell you first. Sections 5, 6 and 11 to 14 continue to apply after your use
            ends.
          </p>
        </Section>

        <Section id="disclaimers" n={11} title="Disclaimers">
          <p className="uppercase text-xs leading-relaxed">
            To the fullest extent permitted by law, the Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;,
            without warranties of any kind, whether express or implied, including warranties of merchantability, fitness
            for a particular purpose, accuracy and non-infringement. We do not promise any particular training or
            performance result.
          </p>
        </Section>

        <Section id="liability" n={12} title="Limitation of liability">
          <p className="uppercase text-xs leading-relaxed">
            To the fullest extent permitted by law, {APP_NAME} and its operator will not be liable for any indirect,
            incidental, special, consequential or punitive damages, or for lost data, profits or opportunities, arising
            from or related to the Service or any training you perform. Our total liability for any claim related to the
            Service is limited to the greater of the amount you paid us in the 12 months before the claim or US $100.
          </p>
          <p>Some places do not allow these limits, so they may not fully apply to you. Nothing in these terms limits liability that cannot be limited by law.</p>
        </Section>

        <Section id="indemnity" n={13} title="Indemnity">
          <p>
            To the extent allowed by law, you agree to cover {APP_NAME} for claims, losses and costs (including
            reasonable legal fees) that arise from your content, your misuse of the Service, or your breaking these terms
            or the law. For coaches, this includes claims arising from training you design or assign.
          </p>
        </Section>

        <Section id="law" n={14} title="Disputes and governing law">
          <p>
            If you have a concern, please contact us first at <Mail /> so we can try to resolve it informally. These terms
            are governed by the laws of the United States and the state in which {APP_NAME}&apos;s operator resides,
            without regard to conflict-of-law rules, except where the law of your home country or state requires
            otherwise.
          </p>
        </Section>

        <Section id="apple" n={15} title="App store terms">
          <p>
            If you download {APP_NAME} from the Apple App Store or Google Play, these terms are between you and{' '}
            {APP_NAME} only, not Apple or Google. Apple and Google are not responsible for the app or its content, have
            no obligation to provide support for it, and are not responsible for any claims relating to it. Apple and its
            subsidiaries are third-party beneficiaries of these terms and may enforce them against you. You must also
            follow the app store&apos;s own usage rules.
          </p>
        </Section>

        <Section id="changes" n={16} title="Changes to these terms">
          <p>
            We may update these terms. We will change the date at the top, and for significant changes we will notify you
            in the app or by email before they take effect. If you keep using the Service after changes take effect, you
            accept the updated terms.
          </p>
        </Section>

        <Section id="contact" n={17} title="Contact us">
          <p>
            {APP_NAME} — {OPERATOR}
            <br />
            Email: <Mail />
          </p>
        </Section>

        <footer className="flex gap-4 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          <Link href="/login" className="hover:text-zinc-300">← Back to {APP_NAME}</Link>
          <Link href="/privacy" className="hover:text-zinc-300">Privacy Policy</Link>
        </footer>
      </div>
    </div>
  )
}
