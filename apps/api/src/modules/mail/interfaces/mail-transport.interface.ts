// Выходной контракт доставки
// Описывает конечное «сырое» письмо (SendMailOptions: кому, тема, HTML-строка, текстовая строка) и интерфейс IMailTransport.send(). Его реализуют наши транспорты.

export interface SendMailOptions {
  to: string; // кому
  subject: string; // тема
  html: string; // html шаблона
  text: string; // текст шаблона нужно для доступности (если старый почтовый клиент, который не умеет отображать html)
  from?: string; // от кого
}

export interface IMailTransport {
  send(options: SendMailOptions): Promise<void>;
}
