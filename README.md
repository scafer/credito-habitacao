# Mortgage Calculator

A free and open-source tool to simulate and track mortgage loans. It calculates monthly payments, total interest, future scenarios with different rate revisions, and simulates early repayments.

## Features

- **Payment plan simulation**: With fixed and variable rate periods
- **Euribor revision history**: Track Euribor rate changes over time, with a chart of the applied rate and one-click import of any month's official rate from Banco de Portugal
- **Future scenarios**: Optimistic, base, and pessimistic forecasts
- **Early repayment simulation**: Calculate the impact of prepayments
- **Bank-switch comparator**: Compare keeping your loan vs. refinancing with another bank
- **Export/Import data**: Backup and restore your configuration
- **Auto-save**: Data stored locally in the browser
- **Installable, works offline**: Add it to your home screen or desktop; it keeps working without a connection

## How to use

1. Open `index.html` in your browser
2. Configure your contract details in the "Settings" tab
3. Add your Euribor revision history in the "Euribor & Scenarios" tab
4. Define future rate scenarios
5. Explore the other tabs for simulations and payment plans

### Requirements

- Web browser
- JavaScript enabled

### Local setup

```bash
git clone https://github.com/scafer/credito-habitacao.git
cd credito-habitacao
# Open index.html in your browser or use a local server
python3 -m http.server 8000
# Visit http://localhost:8000
```

### Running tests

The amortization calculation engine (`calc.js`) has an automated test suite, using Node's built-in test runner (no dependencies):

```bash
npm test
```

## Contributing

Contributions are very welcome! If you find bugs, have suggestions, or want to add features:

1. Open an [issue](https://github.com/scafer/credito-habitacao/issues) on GitHub
2. Fork the repository
3. Create a branch for your feature (`git checkout -b feature/my-feature`)
4. Commit your changes (`git commit -am 'Add my feature'`)
5. Push to the branch (`git push origin feature/my-feature`)
6. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

## Disclaimer

This tool is provided "as is" for informational purposes only. It does not replace professional financial advice. Always check with your bank or financial institution for accurate loan information.
