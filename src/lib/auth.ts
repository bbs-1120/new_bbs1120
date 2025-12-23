import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 許可するメールドメイン
const ALLOWED_DOMAINS = ["shibuya-ad.com"];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // ユーザーを検索
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          return null;
        }

        // パスワード検証
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          teamName: user.teamName,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // メールアドレスがない場合は拒否
      if (!user.email) {
        return false;
      }

      // Credentialsの場合はすでにauthorizeで検証済み
      if (account?.provider === "credentials") {
        return true;
      }

      // Googleログインの場合
      // ドメインチェック
      const emailDomain = user.email.split("@")[1];
      if (!ALLOWED_DOMAINS.includes(emailDomain)) {
        return `/login?error=AccessDenied&message=${encodeURIComponent(
          "許可されていないドメインです。@shibuya-ad.com のメールアドレスでログインしてください。"
        )}`;
      }

      // 既存ユーザーか確認
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      // 新規ユーザーの場合、招待があるか確認
      if (!existingUser) {
        const invite = await prisma.invite.findUnique({
          where: { email: user.email },
        });

        if (!invite || invite.usedAt || new Date() > invite.expiresAt) {
          return `/login?error=AccessDenied&message=${encodeURIComponent(
            "招待されていないメールアドレスです。管理者に招待をリクエストしてください。"
          )}`;
        }

        // ユーザーを作成
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            image: user.image,
            role: invite.role,
            teamName: invite.teamName,
          },
        });

        // 招待を使用済みにする
        await prisma.invite.update({
          where: { email: user.email },
          data: { usedAt: new Date() },
        });
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      // Credentialsログインの場合は直接user情報を使用
      if (user && user.role) {
        token.id = user.id;
        token.role = user.role || "member";
        token.teamName = user.teamName || null;
      } else if (user && user.email) {
        // Googleログインの場合はDBから取得
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.teamName = dbUser.teamName;
        }
      }

      // セッション更新時にDBから最新情報を取得
      if (trigger === "update" && session) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.teamName = dbUser.teamName;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.teamName = token.teamName as string | null;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
