export const formatEstimatedUsd = (
  value: number | null,
  locale: string,
  unavailable: string
): string => {
  if (value === null) return unavailable;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
  if (value > 0 && value < 0.000001) return `<${formatter.format(0.000001)}`;
  if (value < 0 && value > -0.000001) return `>${formatter.format(-0.000001)}`;
  return formatter.format(value);
};
