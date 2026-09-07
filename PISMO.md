# Письмо-приглашение на русском

По умолчанию Supabase шлёт приглашение на английском: «You have been invited». Человек видит незнакомое слово в отправителе и английский текст — и удаляет письмо как спам.

Ниже готовый текст на русском. Меняется один раз.

---

## Куда вставить

**Ссылка:** https://supabase.com/dashboard/project/dcpthwmuiodrjepifzsd/auth/templates

1. Открыть, выбрать вкладку **Invite user**.
2. В поле **Subject heading** стереть английский текст и вставить строку из блока «Тема» ниже.
3. В большом поле с кодом стереть всё и вставить блок «Тело письма».
4. Кнопка **Save** внизу.

---

## Тема

```
Приглашение в «Точку дня»
```

---

## Тело письма

Вставить целиком, ничего не меняя. Строка `{{ .ConfirmationURL }}` — это ссылка, которую Supabase подставит сам.

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#2C1F3D">

  <div style="font-size:22px;font-weight:600;margin-bottom:6px">Точка дня</div>
  <div style="font-size:14px;color:#7A6A88;margin-bottom:28px">Личный органайзер для планов, заметок и расходов</div>

  <div style="font-size:16px;line-height:1.6;margin-bottom:24px">
    Здравствуйте! Вас пригласили в приложение «Точка дня».<br><br>
    Нажмите кнопку ниже и придумайте пароль — он понадобится, чтобы войти в приложение.
  </div>

  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#6B4A96;color:#ffffff;text-decoration:none;
            padding:15px 30px;border-radius:12px;font-size:16px;font-weight:600">
    Придумать пароль
  </a>

  <div style="font-size:14px;line-height:1.6;color:#7A6A88;margin-top:28px">
    Если кнопка не открывается, скопируйте эту ссылку в браузер:<br>
    <span style="word-break:break-all;color:#6B4A96">{{ .ConfirmationURL }}</span>
  </div>

  <div style="border-top:1px solid #E8E0EF;margin:28px 0 0;padding-top:20px;
              font-size:13px;line-height:1.6;color:#9A8CA8">
    Если вы не ждали этого письма, просто удалите его — ничего не произойдёт.
  </div>

</div>
```

---

## Что человек увидит

> **Точка дня**
> Личный органайзер для планов, заметок и расходов
>
> Здравствуйте! Вас пригласили в приложение «Точка дня».
>
> Нажмите кнопку ниже и придумайте пароль — он понадобится, чтобы войти в приложение.
>
> **[ Придумать пароль ]**
>
> Если кнопка не открывается, скопируйте эту ссылку в браузер: …
>
> Если вы не ждали этого письма, просто удалите его — ничего не произойдёт.

Ни одного английского слова, кроме адреса отправителя.

---

## Про отправителя

В строке «от кого» останется адрес Supabase. Поменять его можно, только подключив свою почту для рассылки — это отдельная настройка, и для четырёх человек она не нужна.

Поэтому в своём сообщении стоит предупредить: «письмо придёт с незнакомого адреса, это нормально».

---

## Заодно: письмо для восстановления пароля

На той же странице есть вкладка **Reset password**. Если человек забудет пароль, ему уйдёт английское письмо. Текст для него:

**Тема**

```
Восстановление пароля — «Точка дня»
```

**Тело письма**

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#2C1F3D">

  <div style="font-size:22px;font-weight:600;margin-bottom:28px">Точка дня</div>

  <div style="font-size:16px;line-height:1.6;margin-bottom:24px">
    Вы попросили восстановить пароль. Нажмите кнопку и придумайте новый.
  </div>

  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#6B4A96;color:#ffffff;text-decoration:none;
            padding:15px 30px;border-radius:12px;font-size:16px;font-weight:600">
    Придумать новый пароль
  </a>

  <div style="font-size:14px;line-height:1.6;color:#7A6A88;margin-top:28px">
    Если кнопка не открывается, скопируйте эту ссылку в браузер:<br>
    <span style="word-break:break-all;color:#6B4A96">{{ .ConfirmationURL }}</span>
  </div>

  <div style="border-top:1px solid #E8E0EF;margin:28px 0 0;padding-top:20px;
              font-size:13px;line-height:1.6;color:#9A8CA8">
    Если вы не просили менять пароль, просто удалите это письмо — он останется прежним.
  </div>

</div>
```

---

Автор идеи и концепции приложения — Одинцова И. В. © 2026.
