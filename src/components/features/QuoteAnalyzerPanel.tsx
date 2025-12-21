// Quote Analyzer Panel Component
// Displays quote confidence score, margin analysis, and pricing insights

import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  Percent,
  Target,
  Shield,
  AlertCircle,
} from 'lucide-react';
import {
  analyzeQuote,
  QuoteAnalysis,
  LineItem,
  calculateQuickMargin,
  calculateQuotePrice,
  INDUSTRY_MARGINS,
} from '@/lib/quoteAnalyzer';

interface QuoteAnalyzerPanelProps {
  lineItems: LineItem[];
  projectType: string;
  targetMarginPercent?: number;
  overheadPercent?: number;
  className?: string;
}

export function QuoteAnalyzerPanel({
  lineItems,
  projectType,
  targetMarginPercent = 25,
  overheadPercent = 10,
  className = '',
}: QuoteAnalyzerPanelProps) {
  // Analyze the quote
  const analysis = useMemo(() => {
    return analyzeQuote(lineItems, projectType, targetMarginPercent, overheadPercent);
  }, [lineItems, projectType, targetMarginPercent, overheadPercent]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Confidence score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-amber-100';
    return 'bg-red-100';
  };

  // Risk level colors
  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-amber-100 text-amber-800',
      high: 'bg-red-100 text-red-800',
    };
    return colors[level];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Confidence Score Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Quote Confidence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Score Circle */}
            <div
              className={`flex items-center justify-center w-24 h-24 rounded-full ${getScoreBg(
                analysis.confidence.score
              )}`}
            >
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(analysis.confidence.score)}`}>
                  {analysis.confidence.score}
                </div>
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Completeness</span>
                <span className="font-medium">
                  {analysis.completeness.score}% ({analysis.completeness.itemCount} items)
                </span>
              </div>
              <Progress value={analysis.completeness.score} className="h-2" />

              <div className="flex items-center justify-between text-sm">
                <span>Pricing Accuracy</span>
                <span className="font-medium">
                  {analysis.pricing.anomalies.length === 0 ? '100%' : 'Check anomalies'}
                </span>
              </div>
              <Progress
                value={analysis.pricing.anomalies.length === 0 ? 100 : 70}
                className="h-2"
              />
            </div>
          </div>

          {/* Confidence Issues */}
          {analysis.confidence.issues.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-amber-700 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Issues to Address
              </h4>
              <ul className="text-sm space-y-1">
                {analysis.confidence.issues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-amber-500">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Margin Analysis Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Margin Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Total Cost</div>
              <div className="text-lg font-semibold">{formatCurrency(analysis.margin.totalCost)}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">+ Overhead ({overheadPercent}%)</div>
              <div className="text-lg font-semibold">{formatCurrency(analysis.margin.overhead)}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">= Cost + OH</div>
              <div className="text-lg font-semibold">
                {formatCurrency(analysis.margin.totalCost + analysis.margin.overhead)}
              </div>
            </div>
            <div className="bg-primary/10 p-3 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Target Margin ({targetMarginPercent}%)</div>
              <div className="text-lg font-semibold text-primary">
                {formatCurrency(analysis.margin.targetProfit)}
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Recommended Quote Price</div>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(analysis.margin.recommendedPrice)}
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-5 w-5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Based on costs + {overheadPercent}% overhead + {targetMarginPercent}% margin</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Industry Comparison */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Industry Margin Comparison</h4>
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`p-2 rounded border ${
                  analysis.margin.marginPercent < analysis.margin.industryBenchmark.low
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="text-xs text-muted-foreground">Below Industry</div>
                <div className="font-medium">&lt; {formatPercent(analysis.margin.industryBenchmark.low)}</div>
              </div>
              <div
                className={`p-2 rounded border ${
                  analysis.margin.marginPercent >= analysis.margin.industryBenchmark.low &&
                  analysis.margin.marginPercent <= analysis.margin.industryBenchmark.high
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="text-xs text-muted-foreground">Industry Average</div>
                <div className="font-medium">
                  {formatPercent(analysis.margin.industryBenchmark.low)} -{' '}
                  {formatPercent(analysis.margin.industryBenchmark.high)}
                </div>
              </div>
              <div
                className={`p-2 rounded border ${
                  analysis.margin.marginPercent > analysis.margin.industryBenchmark.high
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="text-xs text-muted-foreground">Above Industry</div>
                <div className="font-medium">&gt; {formatPercent(analysis.margin.industryBenchmark.high)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge className={`${getRiskColor(analysis.risks.level)} text-sm px-3 py-1`}>
              {analysis.risks.level.toUpperCase()} RISK
            </Badge>
            <span className="text-sm text-muted-foreground">
              {analysis.risks.factors.length} risk factor(s) identified
            </span>
          </div>

          {analysis.risks.factors.length > 0 ? (
            <div className="space-y-3">
              {analysis.risks.factors.map((risk, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    risk.severity === 'high'
                      ? 'bg-red-50 border border-red-200'
                      : risk.severity === 'medium'
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <AlertTriangle
                    className={`h-5 w-5 mt-0.5 ${
                      risk.severity === 'high'
                        ? 'text-red-600'
                        : risk.severity === 'medium'
                        ? 'text-amber-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{risk.factor}</div>
                    <div className="text-sm text-muted-foreground">{risk.impact}</div>
                    <div className="text-sm text-primary mt-1">{risk.suggestion}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span>No significant risks identified</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Anomalies Card */}
      {analysis.pricing.anomalies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.pricing.anomalies.map((anomaly, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  {anomaly.type === 'high' ? (
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-amber-600" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {anomaly.item} - {anomaly.type === 'high' ? 'Above' : 'Below'} market rate
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Your rate: {formatCurrency(anomaly.rate)} | Market: {formatCurrency(anomaly.marketRate)}
                      <span className="ml-2">
                        ({anomaly.deviation > 0 ? '+' : ''}
                        {formatPercent(anomaly.deviation)})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Items Card */}
      {analysis.completeness.missingItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-5 w-5" />
              Potentially Missing Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.completeness.missingItems.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Quick margin calculator component
export function QuickMarginCalculator() {
  const [cost, setCost] = React.useState<number>(0);
  const [sellPrice, setSellPrice] = React.useState<number>(0);

  const margin = useMemo(() => {
    return calculateQuickMargin(cost, sellPrice);
  }, [cost, sellPrice]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Quick Margin Calculator</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Total Cost</label>
            <input
              type="number"
              value={cost || ''}
              onChange={e => setCost(parseFloat(e.target.value) || 0)}
              className="w-full p-2 border rounded-md mt-1"
              placeholder="$0.00"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Sell Price</label>
            <input
              type="number"
              value={sellPrice || ''}
              onChange={e => setSellPrice(parseFloat(e.target.value) || 0)}
              className="w-full p-2 border rounded-md mt-1"
              placeholder="$0.00"
            />
          </div>
        </div>

        {cost > 0 && sellPrice > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-muted p-3 rounded-lg text-center">
              <div className="text-xs text-muted-foreground">Gross Profit</div>
              <div className="text-lg font-semibold">{formatCurrency(margin.grossProfit)}</div>
            </div>
            <div className="bg-muted p-3 rounded-lg text-center">
              <div className="text-xs text-muted-foreground">Margin %</div>
              <div className="text-lg font-semibold">{margin.marginPercent.toFixed(1)}%</div>
            </div>
            <div className="bg-muted p-3 rounded-lg text-center">
              <div className="text-xs text-muted-foreground">Markup %</div>
              <div className="text-lg font-semibold">{margin.markupPercent.toFixed(1)}%</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default QuoteAnalyzerPanel;
