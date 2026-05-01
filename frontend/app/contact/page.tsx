'use client'

import { useState } from 'react'
import { LandingNavbar } from '@/features/landing/landing-navbar'
import { Footer } from '@/features/landing/footer'
import {
  Mail, MessageCircle, Clock, CheckCircle, Send,
  ExternalLink, Twitter, ChevronDown
} from 'lucide-react'

const subjects = [
  'General Inquiry',
  'Technical Issue / Bug Report',
  'Billing & Subscription',
  'Feature Request',
  'Account Access',
  'Partnership / Business',
  'Media & Press',
  'Other',
]

const channels = [
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Send us a detailed message and we\'ll get back to you.',
    value: 'support@evalon.app',
    action: 'mailto:support@evalon.app',
    badge: 'Responds in ~4h',
    badgeColor: 'text-[#089981] bg-[#089981]/10',
  },
  {
    icon: MessageCircle,
    title: 'Discord Community',
    description: 'Join our Discord for real-time help from the community.',
    value: 'discord.gg/evalon',
    action: 'https://discord.gg/evalon',
    badge: 'Active community',
    badgeColor: 'text-[#5865F2] bg-[#5865F2]/10',
  },
  {
    icon: Twitter,
    title: 'Twitter / X',
    description: 'DM us on Twitter or mention us for quick updates.',
    value: '@evalonapp',
    action: 'https://twitter.com/evalonapp',
    badge: 'Business hours',
    badgeColor: 'text-[#1d9bf0] bg-[#1d9bf0]/10',
  },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.subject || !form.message) return
    setSending(true)
    // Simulate sending
    setTimeout(() => {
      setSending(false)
      setSubmitted(true)
    }, 1200)
  }

  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc]">
      <LandingNavbar />

      {/* Hero */}
      <div className="pt-28 pb-16 px-4 text-center border-b border-[#2a2e39]/50">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2962ff]/10 border border-[#2962ff]/20 mb-6">
          <Mail className="w-7 h-7 text-[#2962ff]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Contact Us</h1>
        <p className="text-[#787b86] text-lg max-w-xl mx-auto">
          Questions, feedback, or just want to say hello? We&apos;re here for you.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-[1fr,400px] gap-10 items-start">

          {/* Form */}
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-2xl p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-[#089981]/10 border border-[#089981]/20 rounded-full flex items-center justify-center mb-5">
                  <CheckCircle className="w-8 h-8 text-[#089981]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
                <p className="text-[#787b86] max-w-sm">
                  Thanks for reaching out. We&apos;ll get back to you at <span className="text-white">{form.email}</span> within one business day.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }) }}
                  className="mt-8 px-6 py-2.5 bg-[#2962ff] text-white font-medium rounded-full hover:bg-[#1e53e5] transition-colors text-sm"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white mb-6">Send a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-[#d1d4dc] mb-1.5">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        placeholder="John Doe"
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-xl px-4 py-3 text-white placeholder:text-[#787b86] focus:outline-none focus:border-[#2962ff] transition-colors text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#d1d4dc] mb-1.5">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        placeholder="you@example.com"
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-xl px-4 py-3 text-white placeholder:text-[#787b86] focus:outline-none focus:border-[#2962ff] transition-colors text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#d1d4dc] mb-1.5">Subject</label>
                    <div className="relative">
                      <select
                        name="subject"
                        value={form.subject}
                        onChange={handleChange}
                        required
                        className="w-full bg-[#131722] border border-[#2a2e39] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2962ff] transition-colors appearance-none cursor-pointer text-white"
                      >
                        <option value="" disabled>Select a topic...</option>
                        {subjects.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#787b86] pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#d1d4dc] mb-1.5">Message</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      placeholder="Describe your question or issue in detail..."
                      className="w-full bg-[#131722] border border-[#2a2e39] rounded-xl px-4 py-3 text-white placeholder:text-[#787b86] focus:outline-none focus:border-[#2962ff] transition-colors text-sm resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="flex items-center gap-2 px-6 py-3 bg-[#2962ff] text-white font-semibold rounded-full hover:bg-[#1e53e5] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Send Message
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-5">
            {/* Response time */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-[#2962ff]" />
                <h3 className="font-semibold text-white">Support Hours</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#787b86]">Mon – Fri</span>
                  <span className="text-white font-medium">09:00 – 18:00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#787b86]">Saturday</span>
                  <span className="text-white font-medium">10:00 – 14:00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#787b86]">Sunday</span>
                  <span className="text-[#787b86]">Closed</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#2a2e39]">
                  <span className="text-[#787b86]">Timezone</span>
                  <span className="text-white font-medium">Istanbul (UTC+3)</span>
                </div>
              </div>
            </div>

            {/* Contact channels */}
            <div className="space-y-3">
              {channels.map(ch => (
                <a
                  key={ch.title}
                  href={ch.action}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 bg-[#1e222d] border border-[#2a2e39] rounded-xl p-5 hover:border-[#787b86] transition-all group"
                >
                  <div className="bg-[#131722] rounded-lg p-2.5">
                    <ch.icon className="w-5 h-5 text-[#787b86] group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-white text-sm">{ch.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ch.badgeColor}`}>{ch.badge}</span>
                    </div>
                    <p className="text-xs text-[#787b86]">{ch.description}</p>
                    <p className="text-xs text-[#2962ff] mt-1 group-hover:text-[#5585ff] transition-colors">{ch.value}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#787b86] flex-shrink-0 mt-0.5" />
                </a>
              ))}
            </div>

            {/* Premium note */}
            <div className="bg-gradient-to-r from-[#2962ff]/10 to-[#7c3aed]/10 border border-[#2962ff]/20 rounded-2xl p-5">
              <p className="text-sm font-semibold text-white mb-1">Premium Support</p>
              <p className="text-xs text-[#787b86]">
                Premium subscribers get priority support with a guaranteed 2-hour response during business hours.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
