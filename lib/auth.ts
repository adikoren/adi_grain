import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { db } from './db'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Special admin shorthand: allow "admin" as email mapped to admin@grain.internal
        const email =
          credentials.email === 'admin'
            ? 'admin@grain.internal'
            : credentials.email.toLowerCase()

        const user = await db.user.findUnique({ where: { email } })
        if (!user || !user.passwordHash || !user.isActive) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For Google sign-in, verify invitation exists
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase()
        if (!email) return false

        // Check if user already exists (returning user)
        const existingUser = await db.user.findUnique({ where: { email } })
        if (existingUser) return existingUser.isActive

        // New user via Google — check invitation
        const invite = await db.invitation.findFirst({
          where: { email, status: 'PENDING' },
        })
        if (!invite) return '/login?error=not_invited'

        // Create user record
        await db.user.upsert({
          where: { email },
          update: {},
          create: {
            email,
            name: user.name || email.split('@')[0],
            avatarUrl: user.image || undefined,
            role: invite.role,
            isActive: true,
          },
        })

        // Accept invitation
        await db.invitation.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED', acceptedAt: new Date() },
        })
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
      }
      // Refresh role from DB on each request
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isActive: true },
        })
        if (dbUser) {
          token.role = dbUser.role
          if (!dbUser.isActive) return {} as any
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
}

// Extend next-auth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      role: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
  }
}
