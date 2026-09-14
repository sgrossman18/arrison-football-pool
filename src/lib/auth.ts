import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email";

const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/check-email",
  },
  providers: [
    Nodemailer({
      // We fully own sending via lib/email.ts (Resend in prod, console log
      // in dev) instead of using nodemailer's SMTP transport directly.
      server: { host: "unused", port: 0, auth: { user: "", pass: "" } },
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      sendVerificationRequest: sendMagicLinkEmail,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.isAdmin = Boolean(user.isAdmin);
      }
      return session;
    },
  },
  events: {
    // Runs after the user row is guaranteed to exist (unlike the signIn
    // callback, which for the email/magic-link flow fires *before* the row
    // is created). Checked on every sign-in so adding someone to
    // ADMIN_EMAILS later still promotes them next time they log in.
    async signIn({ user }) {
      if (user?.id && user.email && adminEmails.has(user.email.toLowerCase())) {
        if (!user.isAdmin) {
          await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
        }
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
