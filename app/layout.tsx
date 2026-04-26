import './globals.css';

export const metadata = {
  title: 'AI Chat Pro - 聚合AI对话平台',
  description: '基于GPT-4o、Claude等顶级模型的AI对话平台，免费开始，按需升级',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}