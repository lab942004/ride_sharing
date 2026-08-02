export default function About() {
  const features = [
    { icon: '🔒', title: 'College-only Access', desc: 'Only verified domain email holders can join. Your community, your safety.' },
    { icon: '🚗', title: 'Easy Ride Sharing', desc: 'Post or find rides in seconds. Filter by destination, date, and time.' },
    { icon: '💬', title: 'Real-time Chat', desc: 'Chat with your ride partner after request acceptance — coordinate seamlessly.' },
    { icon: '📱', title: 'Phone Sharing', desc: 'Share phone numbers only after mutual consent for maximum privacy.' },
    { icon: '⚡', title: 'Instant Notifications', desc: 'Get notified when your request is accepted, rejected, or when someone requests your ride.' },
    { icon: '♻️', title: 'Eco-Friendly', desc: 'Fewer cars, fewer emissions. Make your commute sustainable for the planet.' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="page-hero py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-5xl font-bold text-charcoal leading-tight">
            About <span className="text-primary">RideShare</span>
          </h1>
          <p className="mt-6 text-lg text-muted leading-relaxed font-body">
            RideShare is a closed-community platform built exclusively for students and staff.
            We believe travel is better together — safer, more affordable, and more fun
            when you're with people you know.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl font-bold text-charcoal">Our Mission</h2>
            <p className="mt-4 text-muted leading-relaxed font-body">
              We're on a mission to make intercity travel for college students smarter, safer,
              and more affordable. By connecting students travelling the same route, we reduce
              costs, carbon footprints, and the anxiety of travelling alone.
            </p>
            <p className="mt-4 text-muted leading-relaxed font-body">
              Our platform is built on trust — every user is a verified member of the community,
              so you always know who you're riding with.
            </p>
          </div>
          <div className="bg-amber-50 rounded-3xl p-8 text-center">
            <div className="text-7xl">🎓</div>
            {/* <p className="font-display text-2xl font-bold mt-4 text-charcoal">NIT Kurukshetra</p> */}
            <p className="text-muted mt-2 font-body">Closed Community Platform</p>
            <div className="flex justify-center gap-8 mt-6">
              <div>
                <p className="font-display text-3xl font-bold text-primary">50+</p>
                <p className="text-xs text-muted mt-1">Active Users</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold text-primary">100+</p>
                <p className="text-xs text-muted mt-1">Rides Created</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold text-primary">98%</p>
                <p className="text-xs text-muted mt-1">Satisfaction</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-cream-dark py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-charcoal text-center mb-12">
            Why Choose RideShare?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="card p-6 hover:border-primary/20 border border-transparent transition-all"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-charcoal text-lg">{f.title}</h3>
                <p className="text-muted text-sm mt-2 leading-relaxed font-body">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl font-bold text-charcoal text-center mb-12">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          {[
            { step: '01', title: 'Sign Up', desc: 'Register with your college email and verify via OTP.' },
            { step: '02', title: 'Find or Post', desc: 'Search for rides or create your own with trip details.' },
            { step: '03', title: 'Request & Accept', desc: 'Send a ride request and wait for the creator to accept.' },
            { step: '04', title: 'Chat & Travel', desc: 'Chat with your ride partner and coordinate the journey.' },
          ].map((s, i) => (
            <div key={i} className="text-center relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="font-display text-2xl font-bold text-primary">{s.step}</span>
              </div>
              <h3 className="font-semibold text-charcoal">{s.title}</h3>
              <p className="text-muted text-sm mt-2 font-body">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
