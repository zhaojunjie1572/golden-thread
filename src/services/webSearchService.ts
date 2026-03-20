interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

interface CryptoData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
}

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description: string;
}

class WebSearchService {
  private serpApiKey: string = '';
  private openWeatherApiKey: string = '';

  setSerpApiKey(key: string) {
    this.serpApiKey = key;
    localStorage.setItem('serp-api-key', key);
  }

  getSerpApiKey(): string {
    if (!this.serpApiKey) {
      this.serpApiKey = localStorage.getItem('serp-api-key') || '';
    }
    return this.serpApiKey;
  }

  setOpenWeatherApiKey(key: string) {
    this.openWeatherApiKey = key;
    localStorage.setItem('openweather-api-key', key);
  }

  getOpenWeatherApiKey(): string {
    if (!this.openWeatherApiKey) {
      this.openWeatherApiKey = localStorage.getItem('openweather-api-key') || '';
    }
    return this.openWeatherApiKey;
  }

  detectQueryType(query: string): 'weather' | 'gold' | 'crypto' | 'stock' | 'news' | 'general' {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('天气') || lowerQuery.includes('weather') || lowerQuery.includes('温度')) {
      return 'weather';
    }
    if (lowerQuery.includes('黄金') || lowerQuery.includes('gold') || lowerQuery.includes('金价')) {
      return 'gold';
    }
    if (lowerQuery.includes('币') || lowerQuery.includes('crypto') || lowerQuery.includes('比特币') || lowerQuery.includes('以太')) {
      return 'crypto';
    }
    if (lowerQuery.includes('股票') || lowerQuery.includes('stock') || lowerQuery.includes('股市')) {
      return 'stock';
    }
    if (lowerQuery.includes('新闻') || lowerQuery.includes('news')) {
      return 'news';
    }
    return 'general';
  }

  async searchWeb(query: string): Promise<SearchResult[]> {
    const queryType = this.detectQueryType(query);
    const serpKey = this.getSerpApiKey();
    
    console.log('=== searchWeb 调试信息 ===');
    console.log('查询内容:', query);
    console.log('查询类型:', queryType);
    console.log('SerpAPI密钥是否存在:', !!serpKey, '密钥长度:', serpKey?.length || 0);
    
    try {
      const results: SearchResult[] = [];
      
      if (serpKey) {
        console.log('开始调用 SerpAPI...');
        const serpResults = await this.searchWithSerpApi(query);
        console.log('SerpAPI 返回结果数量:', serpResults.length);
        if (serpResults.length > 0) {
          console.log('使用真实搜索结果:', serpResults);
          return serpResults;
        } else {
          console.log('SerpAPI 没有返回结果，使用模拟数据');
        }
      } else {
        console.log('没有配置 SerpAPI，使用模拟数据');
      }
      
      if (queryType === 'weather') {
        const weatherInfo = await this.getWeatherInfo();
        if (weatherInfo) {
          results.push({
            title: '天气预报',
            url: '',
            snippet: weatherInfo,
          });
        }
      }
      
      if (queryType === 'gold') {
        const goldInfo = await this.getGoldPriceInfo();
        if (goldInfo) {
          results.push({
            title: '黄金价格',
            url: '',
            snippet: goldInfo,
          });
        }
      }
      
      if (results.length > 0) {
        return results;
      }
      
      if (!serpKey) {
        const response = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
        );
        
        if (!response.ok) {
          return this.fallbackSearch(query, queryType);
        }

        const data = await response.json();

        if (data.Abstract) {
          results.push({
            title: data.Heading || query,
            url: data.AbstractURL || '',
            snippet: data.Abstract,
          });
        }

        if (data.RelatedTopics) {
          data.RelatedTopics.slice(0, 5).forEach((topic: any) => {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0] || topic.Text,
                url: topic.FirstURL,
                snippet: topic.Text,
              });
            }
          });
        }
      }

      return results.length > 0 ? results : this.fallbackSearch(query, queryType);
    } catch (error) {
      console.error('Search error:', error);
      return this.fallbackSearch(query, queryType);
    }
  }

  private async searchWithSerpApi(query: string): Promise<SearchResult[]> {
    try {
      const apiKey = this.getSerpApiKey();
      if (!apiKey) {
        console.log('searchWithSerpApi: 没有 API 密钥');
        return [];
      }

      console.log('=== searchWithSerpApi 调试 ===');
      console.log('发起请求，查询:', query);
      console.log('浏览器User-Agent:', navigator.userAgent);
      
      const isDev = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1');
      
      console.log('是否开发环境:', isDev);
      
      const url = isDev 
        ? `/serpapi/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&engine=google&hl=zh-CN&gl=CN&num=5`
        : `https://serpapi.com/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&engine=google&hl=zh-CN&gl=CN&num=5`;
      
      console.log('请求URL:', url);
      
      let response;
      try {
        response = await fetch(url);
      } catch (error) {
        console.log('直接请求失败，尝试CORS代理...');
        const fallbackUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
          `https://serpapi.com/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&engine=google&hl=zh-CN&gl=CN&num=5`
        )}`;
        console.log('使用代理URL:', fallbackUrl);
        response = await fetch(fallbackUrl);
      }

      console.log('searchWithSerpApi: 响应状态:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('SerpAPI error:', response.status, errorText);
        return [];
      }

      const data = await response.json();
      console.log('searchWithSerpApi: 完整响应数据:', data);
      
      const results: SearchResult[] = [];

      if (data.answer_box) {
        console.log('searchWithSerpApi: 找到 answer_box');
        results.push({
          title: data.answer_box.title || '快速答案',
          url: data.answer_box.link || '',
          snippet: data.answer_box.answer || data.answer_box.snippet || '',
        });
      }

      if (data.organic_results) {
        console.log('searchWithSerpApi: 找到 organic_results，数量:', data.organic_results.length);
        data.organic_results.slice(0, 5).forEach((result: any) => {
          results.push({
            title: result.title || '',
            url: result.link || '',
            snippet: result.snippet || '',
          });
        });
      }

      console.log('searchWithSerpApi: 最终结果数量:', results.length);
      return results;
    } catch (error) {
      console.error('SerpAPI search error:', error);
      return [];
    }
  }

  private async getWeatherInfo(): Promise<string | null> {
    const weatherKey = this.getOpenWeatherApiKey();
    
    if (weatherKey) {
      try {
        const geoResponse = await fetch(
          `https://api.openweathermap.org/geo/1.0/direct?q=Beijing,CN&limit=1&appid=${weatherKey}`
        );
        
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData && geoData[0]) {
            const { lat, lon } = geoData[0];
            
            const weatherResponse = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${weatherKey}&units=metric&lang=zh_cn`
            );
            
            if (weatherResponse.ok) {
              const weatherData = await weatherResponse.json();
              return `当前天气：${weatherData.weather[0].description}，气温 ${weatherData.main.temp}°C，湿度 ${weatherData.main.humidity}%，风速 ${weatherData.wind.speed}m/s`;
            }
          }
        }
      } catch (error) {
        console.error('OpenWeather API error:', error);
      }
    }
    
    try {
      const now = new Date();
      const hour = now.getHours();
      const isDaytime = hour >= 6 && hour < 18;
      
      const conditions = ['晴朗', '多云', '阴天', '小雨', '微风'];
      const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
      const baseTemp = isDaytime ? 22 : 18;
      const temp = baseTemp + Math.floor(Math.random() * 10) - 5;
      const humidity = 40 + Math.floor(Math.random() * 40);
      const windSpeed = 5 + Math.floor(Math.random() * 15);
      
      const note = weatherKey ? '（天气API暂时不可用，使用模拟数据）' : '（注：这是模拟数据，如需真实天气请配置 OpenWeather API 密钥）';
      return `当前天气：${randomCondition}，气温 ${temp}°C，湿度 ${humidity}%，风速 ${windSpeed}km/h。
${note}`;
    } catch (error) {
      console.error('Weather error:', error);
      return null;
    }
  }

  private async getGoldPriceInfo(): Promise<string | null> {
    try {
      const basePricePerGram = 680;
      const variation = (Math.random() - 0.5) * 20;
      const pricePerGram = basePricePerGram + variation;
      const pricePerOunce = pricePerGram * 31.1035;
      const change24h = (Math.random() - 0.5) * 4;
      
      const changeIcon = change24h >= 0 ? '📈' : '📉';
      const changeText = change24h >= 0 ? '上涨' : '下跌';
      
      return `${changeIcon} 黄金价格（人民币）：
- 每克：¥${pricePerGram.toFixed(2)}
- 每盎司：¥${pricePerOunce.toFixed(2)}
- 24小时${changeText}：${Math.abs(change24h).toFixed(2)}%

（注：这是模拟数据，实际黄金价格请查看金融应用）`;
    } catch (error) {
      console.error('Gold price error:', error);
      return null;
    }
  }

  private fallbackSearch(query: string, queryType: string = 'general'): SearchResult[] {
    let hint = '';
    
    switch (queryType) {
      case 'weather':
        hint = '当前无法获取实时天气数据。建议使用专门的天气应用查询。';
        break;
      case 'gold':
        hint = '当前无法获取实时黄金价格数据。建议使用金融应用或网站查询。';
        break;
      case 'crypto':
        hint = '当前无法获取实时虚拟币数据。建议使用 CoinGecko、Binance 等平台查询。';
        break;
      case 'stock':
        hint = '当前无法获取实时股票数据。建议使用券商应用或财经网站查询。';
        break;
      default:
        hint = `当前无法获取实时搜索结果。你可以尝试访问搜索引擎查询"${query}"获取最新信息。`;
    }
    
    return [
      {
        title: '查询提示',
        url: '',
        snippet: hint,
      },
    ];
  }

  async getStockPrice(symbol: string): Promise<StockData | null> {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd&include_24hr_change=true`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const cryptoData = data[symbol.toLowerCase()];
      
      if (cryptoData) {
        return {
          symbol: symbol.toUpperCase(),
          price: cryptoData.usd,
          change: cryptoData.usd_24h_change || 0,
          changePercent: cryptoData.usd_24h_change || 0,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Stock error:', error);
      return null;
    }
  }

  async getCryptoPrices(): Promise<CryptoData[]> {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h'
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.map((coin: any) => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h || 0,
      }));
    } catch (error) {
      console.error('Crypto error:', error);
      return [];
    }
  }

  async getNews(category: 'general' | 'technology' = 'general'): Promise<NewsArticle[]> {
    try {
      const news = [
        {
          title: '实时新闻提示',
          url: 'https://news.google.com',
          source: 'Google News',
          publishedAt: new Date().toISOString(),
          description: '访问新闻网站获取最新的' + (category === 'technology' ? '科技' : '') + '新闻资讯。',
        },
      ];
      return news;
    } catch (error) {
      console.error('News error:', error);
      return [];
    }
  }

  buildSearchContext(_query: string, searchResults: SearchResult[]): string {
    if (searchResults.length === 0) return '';

    let context = '【重要】这是刚刚从互联网搜索到的最新信息，请优先使用以下搜索结果来回答用户的问题：\n\n';
    
    searchResults.forEach((result, index) => {
      context += `--- 搜索结果 ${index + 1} ---\n`;
      context += `标题: ${result.title}\n`;
      if (result.snippet) {
        context += `内容: ${result.snippet}\n`;
      }
      if (result.url) {
        context += `链接: ${result.url}\n`;
      }
      context += '\n';
    });

    context += '【指令】\n';
    context += '1. 请完全基于以上搜索结果来回答用户的问题\n';
    context += '2. 如果搜索结果中有具体数据或价格，请直接引用\n';
    context += '3. 如果搜索结果中有时间信息，请提及信息的时效性\n';
    context += '4. 不要编造搜索结果中没有的信息\n';
    context += '5. 回答时要清晰表明你使用了搜索结果\n';
    
    return context;
  }

  buildCryptoContext(cryptoData: CryptoData[]): string {
    if (cryptoData.length === 0) return '';

    let context = '当前虚拟币行情（仅供参考）：\n\n';
    
    cryptoData.forEach((coin) => {
      const changeIcon = coin.change24h >= 0 ? '📈' : '📉';
      context += `${changeIcon} ${coin.name} (${coin.symbol}): $${coin.price.toLocaleString()} (${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%)\n`;
    });

    return context;
  }
}

export const webSearchService = new WebSearchService();
export type { SearchResult, StockData, CryptoData, NewsArticle };
