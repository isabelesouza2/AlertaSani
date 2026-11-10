# AlertaSani

Protótipo acadêmico para registrar e visualizar ocorrências relacionadas ao saneamento básico em Três Lagoas - MS.

## Arquivos

- `index.html` — estrutura da página e janelas de login, cadastro e registro.
- `style.css` — estilos do site (um único CSS).
- `js/app.js` — navegação, demonstração de autenticação e integração dos pontos no mapa.
- `js/config.js` — configuração da chave do Google Maps.

## Como abrir no VS Code

1. Extraia a pasta `AlertaSani`.
2. Abra a pasta no VS Code.
3. Abra o `index.html` usando a extensão **Live Server**.
4. O mapa do Google será ativado depois de configurar a chave descrita abaixo.

## Configurar o Google Maps

O mapa usa a API JavaScript do Google Maps e precisa de uma chave própria.

1. Acesse https://console.cloud.google.com/
2. Crie ou selecione um projeto no Google Cloud.
3. Ative **Maps JavaScript API**.
4. Configure uma conta de faturamento, conforme exigido pelo Google.
5. Crie uma chave de API.
6. Restrinja a chave por site (HTTP referrers) aos domínios em que o projeto será publicado. Durante o desenvolvimento, inclua o endereço local usado pelo Live Server.
7. Abra `js/config.js` e substitua `COLE_SUA_CHAVE_DO_GOOGLE_MAPS_AQUI` pela chave.

**Atenção:** a chave do Google Maps usada no navegador pode ser vista por visitantes. Restrinja-a por domínio e API; nunca publique uma chave sem restrições. Consulte os preços e as condições atuais do Google Maps Platform antes de ativar o faturamento.

## Como usar o protótipo

1. Clique em **Entrar** e depois em **Criar conta**.
2. Use apenas um e-mail e uma senha fictícios para demonstração.
3. Abra **Mapa**.
4. Clique em qualquer local do mapa para abrir o formulário de ocorrência.
5. Preencha categoria, título e descrição e salve.
6. O marcador aparecerá no mapa e na lista lateral. Clique no marcador ou no item da lista para ver/centralizar a ocorrência.

Também é possível usar o botão **Adicionar ponto** na seção do mapa.

## Limitações importantes desta versão

Esta é uma demonstração front-end, não um sistema pronto para receber dados reais:

- As contas e os pontos ficam armazenados apenas no `localStorage` do navegador usado. Não são compartilhados entre pessoas, dispositivos ou navegadores.
- A senha é derivada com PBKDF2 para a demonstração local, mas isso **não transforma o navegador em um ambiente de autenticação seguro**. Não use senhas reais.
- Não há backend, moderação, painel administrativo nem envio para a Prefeitura.
- Os pontos não são enviados a um servidor.
- Não solicite nem armazene CPF, endereço residencial completo, telefone ou outros dados pessoais nesta versão.

Para uso real, a próxima etapa é integrar autenticação e banco de dados (por exemplo, Supabase), definir regras de acesso e política de privacidade e revisar a segurança antes de publicar.

## Publicar no GitHub

Envie a pasta inteira mantendo esta estrutura:

```text
AlertaSani/
├── index.html
├── style.css
├── README.md
└── js/
    ├── app.js
    └── config.js
```

Se publicar pelo GitHub Pages, configure também a restrição da chave do Google Maps para o domínio do seu site.
