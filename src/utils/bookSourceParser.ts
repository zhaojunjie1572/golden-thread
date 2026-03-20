export interface ParseLog {
  step: string;
  rule: string;
  input: string;
  output: string;
  success: boolean;
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
        
        if (r.startsWith('@Js:')) {
          this.addLog('Skip JS', r, result, result, true);
          continue;
        }
        
        const parts = r.split('||').map(p => p.trim());
        
        let found = false;
        for (const part of parts) {
          try {
            const parsed = this.parseSingleRule(result, part);
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

    if (rule.startsWith('$')) {
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
    
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      
      const elements = doc.querySelectorAll(rule);
      
      return Array.from(elements).map(el => el.outerHTML);
    } catch (error) {
      console.error('列表解析失败:', rule, error);
      return [];
    }
  }
}
