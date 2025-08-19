"use client";
import React from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";

export function Providers({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

  if (!clientId) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2>Configuração necessária</h2>
        <p>Defina a variável <code>NEXT_PUBLIC_THIRDWEB_CLIENT_ID</code> no arquivo <code>.env.local</code>:</p>
        <pre>NEXT_PUBLIC_THIRDWEB_CLIENT_ID=seu_client_id</pre>
        <p>Depois reinicie o servidor: <code>pnpm dev</code>.</p>
      </div>
    );
  }

  // Suporte às variações do provider: passar clientId diretamente evita mismatch de tipos
  return <ThirdwebProvider {...({ clientId } as any)}>{children}</ThirdwebProvider>;
}


