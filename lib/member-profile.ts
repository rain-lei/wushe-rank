export type MemberProfile = { signature: string; avatar: string | null };
export type MemberProfiles = Record<string, MemberProfile>;
export const signatureLimit = 280;
export const profileByteLimit = 8192;
export const avatarByteLimit = 2 * 1024 * 1024;
const avatarPath = /^avatars\/(\d{3})\.(png|jpe?g|webp)$/;

export function avatarOwner(path: string) {
  return avatarPath.exec(path)?.[1];
}

export function profileTemplate(id: string) {
  return "# 群友 " + id + "\n\n<!-- 在这里写个性签名。 -->\n\n" +
    "<!-- 更换头像时，把图片上传到同一分支的 profiles/avatars/，再取消下面这行的注释。 -->\n" +
    "<!-- ![头像](avatars/" + id + ".png) -->\n";
}

export function parseProfileMarkdown(id: string, markdown: string): MemberProfile {
  const text = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "").trim();
  if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text) || text.includes("<!--")) {
    throw Error("资料含有无效的控制字符或未闭合的注释。");
  }
  const lines = text.split("\n");
  if (/^#\s+群友\s+\d+/.test(lines[0])) {
    if (lines.shift()?.trim() !== "# 群友 " + id) throw Error("标题中的群友编号应与文件名一致。");
  }
  const body: string[] = [];
  let avatar: string | null = null;
  for (const line of lines) {
    if (!line.includes("![")) {
      body.push(line.trimEnd());
      continue;
    }
    const image = /^!\[[^\]\n]*\]\((?:\.\/)?([^()\s]+)\)$/.exec(line.trim());
    if (!image || avatarOwner(image[1]) !== id) throw Error("头像请单独写一行，引用 avatars/" + id + ".png、.jpg 或 .webp。");
    if (avatar) throw Error("每位群友只能指定一张头像。");
    avatar = image[1];
  }
  const signature = body.join("\n").trim();
  if (Array.from(signature).length > signatureLimit) throw Error("签名最多 " + signatureLimit + " 个字符。");
  return { signature, avatar };
}
