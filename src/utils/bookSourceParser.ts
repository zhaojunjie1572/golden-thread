export interface ParseLog {
  step: string;
  rule: string;
  input: string;
  output: string;
  success: boolean;
}

const cache: Map<string, any> = new Map();

class CryptoHelper {
  static base64Encode(str: string): string {
    return btoa(unescape(encodeURIComponent(str)));
  }

  static base64Decode(str: string): string {
    return decodeURIComponent(escape(atob(str)));
  }

  static aesEncrypt(text: string, key: string): string {
    try {
      const keyBytes = new TextEncoder().encode(key.padEnd(16, '\0').slice(0, 16));
      const textBytes = new TextEncoder().encode(text);
      let encrypted = '';
      for (let i = 0; i < textBytes.length; i++) {
        encrypted += String.fromCharCode(textBytes[i] ^ keyBytes[i % keyBytes.length]);
      }
      return this.base64Encode(encrypted);
    } catch (e) {
      console.error('AES加密失败:', e);
      return text;
    }
  }

  static aesDecrypt(encrypted: string, key: string): string {
    try {
      const keyBytes = new TextEncoder().encode(key.padEnd(16, '\0').slice(0, 16));
      const decoded = this.base64Decode(encrypted);
      let decrypted = '';
      for (let i = 0; i < decoded.length; i++) {
        decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ keyBytes[i % keyBytes.length]);
      }
      return decrypted;
    } catch (e) {
      console.error('AES解密失败:', e);
      return encrypted;
    }
  }
}

export class BookSourceParser {
  static logs: ParseLog[] = [];

  static clearLogs() {
    this.logs = [];
  }

  static getLogs(): ParseLog[] {
    return this.logs;
  }

  private static addLog(step: string, rule: string, input: string, output: string, success: boolean) {
    this.logs.push({ step, rule, input: input.substring(0, 200), output: output.substring(0, 200), success });
  }

  private static executeJs(jsCode: string, context: any = {}): any {
    try {
      const sandbox = {
        result: context.result || '',
        ...context,
        java: {
          createSymmetricCrypto: (algorithm: string, key: string, _iv: string) => ({
            decrypt: (data: string) => {
              if (algorithm.toLowerCase().includes('aes')) {
                return CryptoHelper.aesDecrypt(data, key);
              }
              return data;
            },
            encrypt: (data: string) => {
              if (algorithm.toLowerCase().includes('aes')) {
                return CryptoHelper.aesEncrypt(data, key);
              }
              return data;
            },
          })
        },
        cache: {
          get: (key: string) => cache.get(key),
          put: (key: string, value: any) => cache.set(key, value)
        },
        base64: {
          encode: CryptoHelper.base64Encode,
          decode: CryptoHelper.base64Decode
        },
        CryptoJS: {
          AES: {
            decrypt: (ciphertext: string, key: string, _encoding?: any) => ({
              toString: (_encoding?: any) => CryptoHelper.aesDecrypt(ciphertext, key)
            }),
            encrypt: (plaintext: string, key: string) => ({
              toString: () => CryptoHelper.aesEncrypt(plaintext, key)
            })
          }
        }
      };

      const code = `
        with (sandbox) {
          ${jsCode}
        }
      `;

      const fn = new Function('sandbox', code);
      return fn(sandbox);
    } catch (error) {
      console.error('JS执行失败:', jsCode, error);
      return context.result || '';
    }
  }

  static parseRule(text: string, rule: string): string {
    this.clearLogs();
    if (!rule) {
      this.addLog('Empty Rule', rule, text, text, true);
      return text;
    }
    
    try {
      let result = text;
      const rules = rule.split('&&').map(r => r.trim()).filter(r => r);
      
      this.addLog('Start', rule, text, result, true);
      
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        if (!r) continue;
        
        if (r.startsWith('@Js:') || r.startsWith('@js:')) {
          const jsCode = r.slice(4).trim();
          this.addLog('Execute JS', jsCode, result, '', true);
          const jsResult = this.executeJs(jsCode, { result });
          result = String(jsResult ?? result);
          this.addLog('JS Result', '', '', result, true);
          continue;
        }
        
        const parts = r.split('||').map(p => p.trim());
        
        let found = false;
        for (const part of parts) {
          try {
            let parsed = this.parseSingleRule(result, part);
            
            if ((parsed === undefined || parsed === null || parsed === '') && part.startsWith('$.')) {
              try {
                JSON.parse(result);
              } catch {
                try {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(result, 'text/html');
                  const scriptTag = doc.querySelector('script[type="application/json"], script');
                  if (scriptTag) {
                    const jsonText = scriptTag.textContent || '';
                    JSON.parse(jsonText);
                    parsed = this.parseSingleRule(jsonText, part);
                  }
                } catch {}
              }
            }
            
            if (parsed !== undefined && parsed !== null && parsed !== '') {
              result = parsed;
              found = true;
              this.addLog(`Rule ${i + 1}`, part, result, result, true);
              break;
            }
          } catch (e) {
            this.addLog(`Rule ${i + 1} Failed`, part, result, '', false);
            continue;
          }
        }
        
        if (!found && parts.length > 0) {
          this.addLog(`Rule ${i + 1} No Match`, r, result, result, false);
        }
      }
      
      return result;
    } catch (error) {
      console.error('解析规则失败:', rule, error);
      this.addLog('Error', rule, text, '', false);
      return '';
    }
  }

  private static parseSingleRule(text: string, rule: string): string | undefined {
    if (!rule) return undefined;

    if (rule.startsWith('$.')) {
      return this.parseJsonPath(text, rule);
    } else if (rule.startsWith('$')) {
      return this.parseXpath(text, rule);
    } else if (rule.startsWith('css:')) {
      return this.parseCss(text, rule.slice(4));
    } else if (rule.startsWith('class:')) {
      return this.parseClass(text, rule.slice(6));
    } else if (rule.startsWith('id:')) {
      return this.parseId(text, rule.slice(3));
    } else if (rule.startsWith('tag:')) {
      return this.parseTag(text, rule.slice(4));
    } else if (rule.startsWith('text')) {
      return this.parseText(text, rule);
    } else if (rule.startsWith('replace:')) {
      return this.parseReplace(text, rule.slice(8));
    } else if (rule.startsWith('json:')) {
      return this.parseJson(text, rule.slice(5));
    } else if (rule.startsWith('##')) {
      return this.parseSplit(text, rule.slice(2));
    } else if (rule.startsWith('regex:')) {
      return this.parseRegex(text, rule.slice(6));
    } else if (rule === 'textNodes' || rule === 'text') {
      return this.getTextNodes(text);
    } else if (rule.includes('@')) {
      return this.parseAttributeSelector(text, rule);
    } else {
      return this.parseSimple(text, rule);
    }
  }

  private static parseJsonPath(text: string, rule: string): string | undefined {
    try {
      let json;
      
      try {
        json = JSON.parse(text);
      } catch {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const scriptTags = doc.querySelectorAll('script');
          
          for (const script of scriptTags) {
            const content = script.textContent || '';
            if (content.trim()) {
              try {
                json = JSON.parse(content);
                break;
              } catch {
                const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                if (jsonMatch) {
                  try {
                    json = JSON.parse(jsonMatch[0]);
                    break;
                  } catch {}
                }
              }
            }
          }
          
          if (!json) {
            return undefined;
          }
        } catch {
          return undefined;
        }
      }
      
      const path = rule.slice(2);
      const keys = path.split('.');
      let result: any = json;
      
      for (const key of keys) {
        if (result && typeof result === 'object') {
          const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
          if (arrayMatch) {
            result = result[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
          } else {
            result = result[key];
          }
        } else {
          break;
        }
      }
      
      if (result !== undefined && result !== null) {
        if (Array.isArray(result)) {
          return result.join(',');
        }
        return String(result);
      }
    } catch (error) {
      console.error('JSON路径解析失败:', rule, error);
    }
    return undefined;
  }

  private static parseAttributeSelector(text: string, rule: string): string | undefined {
    try {
      const [selPart, ...attrParts] = rule.split('@');
      const attr = attrParts.join('@');
      const selector = selPart.trim();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      
      let el: Element | null = null;
      
      if (selector) {
        el = doc.querySelector(selector);
      } else {
        el = doc.body;
      }
      
      if (!el) return undefined;
      
      if (attr === 'text' || attr === 'text()') {
        return el.textContent || '';
      } else if (attr === 'html' || attr === 'outerHTML') {
        return el.outerHTML;
      } else if (attr === 'innerHTML') {
        return el.innerHTML;
      } else {
        return el.getAttribute(attr) || '';
      }
    } catch (error) {
      console.error('属性选择器解析失败:', rule, error);
      return undefined;
    }
  }

  private static parseSimple(text: string, rule: string): string | undefined {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      
      if (rule.includes('@')) {
        const [sel, attr] = rule.split('@');
        const el = doc.querySelector(sel);
        if (el) {
          return el.getAttribute(attr) || '';
        }
      } else {
        const el = doc.querySelector(rule);
        if (el) {
          return el.textContent || '';
        }
      }
    } catch (error) {
      console.error('简单选择器解析失败:', rule, error);
    }
    return undefined;
  }

  private static parseXpath(text: string, rule: string): string | undefined {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      
      const result = doc.evaluate(
        rule.slice(1),
        doc,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      
      if (result.singleNodeValue) {
        return (result.singleNodeValue as Node).textContent || '';
      }
    } catch (error) {
      console.error('XPath 解析失败:', rule, error);
    }
    return undefined;
  }

  private static parseCss(text: string, selector: string): string | undefined {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const el = doc.querySelector(selector);
      
      if (el) {
        return el.textContent || '';
      }
    } catch (error) {
      console.error('CSS 选择器解析失败:', selector, error);
    }
    return undefined;
  }

  private static parseClass(text: string, className: string): string | undefined {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const el = doc.getElementsByClassName(className)[0];
      
      if (el) {
        return el.textContent || '';
      }
    } catch (error) {
      console.error('Class 解析失败:', className, error);
    }
    return undefined;
  }

  private static parseId(text: string, id: string): string | undefined {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const el = doc.getElementById(id);
      
      if (el) {
        return el.textContent || '';
      }
    } catch (error) {
      console.error('ID 解析失败:', id, error);
    }
    return undefined;
  }

  private static parseTag(text: string, tag: string): string | undefined {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const el = doc.getElementsByTagName(tag)[0];
      
      if (el) {
        return el.textContent || '';
      }
    } catch (error) {
      console.error('Tag 解析失败:', tag, error);
    }
    return undefined;
  }

  private static parseText(text: string, _rule: string): string | undefined {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return doc.body.textContent || '';
    } catch (error) {
      console.error('Text 解析失败:', error);
    }
    return undefined;
  }

  private static parseReplace(text: string, rule: string): string {
    try {
      const parts = rule.split(',');
      if (parts.length >= 2) {
        let search = parts[0].trim();
        let replace = parts.slice(1).join(',').trim();
        
        if (search.startsWith('/') && search.endsWith('/')) {
          const regexPattern = search.slice(1, -1);
          const regex = new RegExp(regexPattern, 'g');
          return text.replace(regex, replace);
        }
        
        return text.replace(new RegExp(search, 'g'), replace);
      }
    } catch (error) {
      console.error('Replace 解析失败:', rule, error);
    }
    return text;
  }

  private static parseJson(text: string, rule: string): string | undefined {
    try {
      const json = JSON.parse(text);
      const keys = rule.split('.');
      let result: any = json;
      
      for (const key of keys) {
        if (result && typeof result === 'object') {
          const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
          if (arrayMatch) {
            result = result[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
          } else {
            result = result[key];
          }
        } else {
          break;
        }
      }
      
      if (result !== undefined && result !== null) {
        return String(result);
      }
    } catch (error) {
      console.error('JSON 解析失败:', rule, error);
    }
    return undefined;
  }

  private static parseSplit(text: string, rule: string): string | undefined {
    try {
      const match = rule.match(/^(\d+)(.*)$/);
      if (match) {
        const index = parseInt(match[1]);
        const separator = match[2];
        const parts = text.split(separator);
        return parts[index] || undefined;
      }
    } catch (error) {
      console.error('Split 解析失败:', rule, error);
    }
    return text;
  }

  private static parseRegex(text: string, rule: string): string | undefined {
    try {
      const match = rule.match(/^\/(.*?)\/([gimsuy]*)$/);
      if (match) {
        const regex = new RegExp(match[1], match[2]);
        const result = text.match(regex);
        if (result && result.length > 1) {
          return result[1];
        }
        if (result) {
          return result[0];
        }
      }
    } catch (error) {
      console.error('Regex 解析失败:', rule, error);
    }
    return undefined;
  }

  private static getTextNodes(text: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      return doc.body.textContent || '';
    } catch (error) {
      console.error('Text nodes 解析失败:', error);
    }
    return text;
  }

  static parseList(text: string, rule: string): string[] {
    if (!rule) return [];
    
    const parts = rule.split('||').map(p => p.trim()).filter(p => p);
    
    for (const part of parts) {
      try {
        if (part.startsWith('$.')) {
          let json;
          
          try {
            json = JSON.parse(text);
          } catch {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(text, 'text/html');
              const scriptTags = doc.querySelectorAll('script');
              
              for (const script of scriptTags) {
                const content = script.textContent || '';
                if (content.trim()) {
                  try {
                    json = JSON.parse(content);
                    break;
                  } catch {
                    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                    if (jsonMatch) {
                      try {
                        json = JSON.parse(jsonMatch[0]);
                        break;
                      } catch {}
                    }
                  }
                }
              }
              
              if (!json) {
                continue;
              }
            } catch {
              continue;
            }
          }
          
          const path = part.slice(2);
          const keys = path.split('.');
          let result: any = json;
          
          for (const key of keys) {
            if (result && typeof result === 'object') {
              const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
              if (arrayMatch) {
                result = result[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
              } else {
                result = result[key];
              }
            } else {
              break;
            }
          }
          
          if (Array.isArray(result)) {
            return result.map(item => JSON.stringify(item));
          }
          continue;
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        const elements = doc.querySelectorAll(part);
        
        if (elements.length > 0) {
          return Array.from(elements).map(el => el.outerHTML);
        }
      } catch (error) {
        console.error('列表解析规则失败:', part, error);
        continue;
      }
    }
    
    console.error('所有列表解析规则都失败:', rule);
    return [];
  }
}
