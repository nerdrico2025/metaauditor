import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head />
      <body className="bg-white text-click-black dark:bg-click-dark-gray dark:text-click-white">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
