import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      bccAddress: string;
    };
  }

  interface User {
    bccAddress?: string;
  }
}
