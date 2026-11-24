import { readFile, readdir, lstat } from "node:fs/promises";
import { avatarByteLimit, avatarOwner, parseProfileMarkdown, profileByteLimit } from "../lib/member-profile.ts";
import { validMember } from "../lib/voting-common.ts";

const root = new URL("../profiles/", import.meta.url);
const images = new Set();
const errors = [];
let profileCount = 0;

if (!(await lstat(new URL("avatars/", root))).isDirectory()) throw Error("profiles/avatars 应为仓库内的目录。");
for (const file of await readdir(new URL("avatars/", root), { withFileTypes: true })) {
  if (file.name === ".gitkeep" && file.isFile()) continue;
  const path = "avatars/" + file.name;
  try {
    if (!file.isFile() || !validMember(Number(avatarOwner(path)))) throw Error("请使用三位群友编号和 PNG、JPEG 或 WebP 扩展名。");
    const url = new URL(path, root);
    if ((await lstat(url)).size > avatarByteLimit) throw Error("头像超过 2 MiB。");
    const data = await readFile(url);
    const png = data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
    const jpeg = data.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
    const webp = data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    if (!(path.endsWith(".png") ? png : path.endsWith(".webp") ? webp : jpeg)) throw Error("头像内容与扩展名不符。");
    images.add(path);
  } catch (error) { errors.push("profiles/" + path + "：" + error.message); }
}
for (const file of await readdir(root, { withFileTypes: true })) {
  if ((file.name === "README.md" && file.isFile()) || (file.name === "avatars" && file.isDirectory())) continue;
  try {
    const id = /^(\d{3})\.md$/.exec(file.name)?.[1];
    if (!file.isFile() || !id || !validMember(Number(id))) throw Error("请按三位群友编号命名 Markdown 文件。");
    const url = new URL(file.name, root);
    if ((await lstat(url)).size > profileByteLimit) throw Error("资料文件过大。");
    const { avatar } = parseProfileMarkdown(id, await readFile(url, "utf8"));
    if (avatar && !images.has(avatar)) throw Error("请把 " + avatar + " 和这份资料放在同一个 PR。");
    profileCount++;
  } catch (error) { errors.push("profiles/" + file.name + "：" + error.message); }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("已校验 " + profileCount + " 份群友资料、" + images.size + " 张自选头像。");
}
