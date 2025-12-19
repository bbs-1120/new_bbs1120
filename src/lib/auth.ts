import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// 許可するメールドメイン
const ALLOWED_DOMAINS = ["shibuya-ad.com"];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // メールアドレスがない場合は拒否
      if (!user.email) {
        return false;
      }

      // ドメインチェック
      const emailDomain = user.email.split("@")[1];
      if (!ALLOWED_DOMAINS.includes(emailDomain)) {
        return `/login?error=AccessDenied&message=${encodeURIComponent(
          "許可されていないドメインです。@shibuya-ad.com のメールアドレスでログインしてください。"
        )}`;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});

