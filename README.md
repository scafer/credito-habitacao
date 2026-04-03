# Crédito Habitação

Uma ferramenta gratuita e open-source para simular e acompanhar empréstimos à habitação. Permite calcular prestações, juros totais, cenários futuros com diferentes taxas de revisão e simular amortizações antecipadas.

## Funcionalidades

- **Simulação de plano de pagamentos**: Com períodos de taxa fixa e variável
- **Histórico de revisões Euribor**: Registo de mudanças nas taxas Euribor ao longo do tempo
- **Cenários futuros**: Optimista, base e pessimista para previsões
- **Simulação de abatimentos**: Calcular impacto de pagamentos antecipados
- **Exportar/Importar dados**: Backup e restauração de configurações
- **Gravação automática**: Dados guardados no browser localmente

## Como usar

1. Abra o ficheiro `index.html` no seu browser
2. Configure os dados do contrato na aba "Configuração"
3. Adicione o histórico de revisões Euribor na aba "Euribor & Cenários"
4. Defina os cenários futuros
5. Explore as outras abas para ver simulações e planos

### Requisitos

- Navegador web
- JavaScript activado

### Instalação local

```bash
git clone https://github.com/scafer/credito-habitacao.git
cd credito-habitacao
# Abra index.html no browser ou use um servidor local
python3 -m http.server 8000
# Acesse http://localhost:8000
```

## Contribuição

Contribuições são muito bem-vindas! Se encontrar bugs, tiver sugestões ou quiser adicionar funcionalidades:

1. Abra um [issue](https://github.com/scafer/credito-habitacao/issues) no GitHub
2. Faça um fork do repositório
3. Crie uma branch para a sua funcionalidade (`git checkout -b feature/nova-funcionalidade`)
4. Faça commit das suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
5. Faça push para a branch (`git push origin feature/nova-funcionalidade`)
6. Abra um Pull Request

## Licença

Este projecto está licenciado sob a [MIT License](LICENSE) - veja o ficheiro LICENSE para detalhes.

## Aviso

Esta ferramenta é fornecida "como está" para fins informativos. Não substitui aconselhamento financeiro profissional. Verifique sempre com o seu banco ou instituição financeira para informações precisas sobre empréstimos.