import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    isAdmin: boolean;
  }
}

declare module "@auth/core/types" {
  interface User {
    isAdmin?: boolean;
  }
}
