import JSZip from 'jszip';

interface EpubContent {
  title: string;
  author: string;
  content: string;
}

/**
 * 解析 EPUB 文件
 */
export async function parseEpubFile(file: File): Promise<EpubContent> {
  const zip = await JSZip.loadAsync(file);

  // 找到 container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    throw new Error('无效的 EPUB 文件：缺少 container.xml');
  }

  // 解析 container.xml 找到 OPF 文件路径
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfPathMatch) {
    throw new Error('无效的 EPUB 文件：无法找到 OPF 文件路径');
  }
  const opfPath = opfPathMatch[1];

  // 读取 OPF 文件
  const opfContent = await zip.file(opfPath)?.async('text');
  if (!opfContent) {
    throw new Error('无效的 EPUB 文件：无法读取 OPF 文件');
  }

  // 解析 OPF 文件获取元数据和章节列表
  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfContent, 'application/xml');

  // 获取标题和作者
  const title = opfDoc.querySelector('metadata > title, metadata > dc\\:title')?.textContent || '未命名书籍';
  const author = opfDoc.querySelector('metadata > creator, metadata > dc\\:creator')?.textContent || '未知作者';

  // 获取所有章节文件
  const itemRefs = opfDoc.querySelectorAll('spine > itemref');
  const manifest = opfDoc.querySelector('manifest');

  if (!manifest) {
    throw new Error('无效的 EPUB 文件：缺少 manifest');
  }

  // 获取 OPF 文件所在目录
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  let fullContent = '';

  // 按顺序读取每个章节
  for (const itemRef of Array.from(itemRefs)) {
    const idref = itemRef.getAttribute('idref');
    if (!idref) continue;

    const item = manifest.querySelector(`item[id="${idref}"]`);
    if (!item) continue;

    const href = item.getAttribute('href');
    if (!href) continue;

    // 构建完整的文件路径
    const filePath = opfDir + href;
    const chapterContent = await zip.file(filePath)?.async('text');

    if (chapterContent) {
      // 解析 HTML 内容，提取文本
      const chapterDoc = parser.parseFromString(chapterContent, 'text/html');
      const text = chapterDoc.body?.textContent || '';
      fullContent += text + '\n\n';
    }
  }

  if (!fullContent.trim()) {
    throw new Error('无法提取 EPUB 内容');
  }

  return {
    title,
    author,
    content: fullContent.trim(),
  };
}

/**
 * 检查文件是否是 EPUB 格式
 */
export function isEpubFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.epub');
}
