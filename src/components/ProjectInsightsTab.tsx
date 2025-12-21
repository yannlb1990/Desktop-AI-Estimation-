import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AlertCircle, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";

interface ProjectInsightsTabProps {
  estimateItems: Array<{
    category: string;
    total_price: number;
  }>;
}

export const ProjectInsightsTab = ({ estimateItems }: ProjectInsightsTabProps) => {
  // Calculate cost breakdown by trade/category
  const costByCategory = estimateItems.reduce((acc, item) => {
    const existing = acc.find(c => c.name === item.category);
    if (existing) {
      existing.value += item.total_price;
    } else {
      acc.push({ 
        name: item.category, 
        value: item.total_price,
        color: getCategoryColor(item.category)
      });
    }
    return acc;
  }, [] as Array<{ name: string; value: number; color: string }>);

  // Sort by value descending
  costByCategory.sort((a, b) => b.value - a.value);

  // Margin analysis (mock data - would come from real analysis)
  const marginData = [
    { trade: 'Carpentry', yourMargin: 22, marketAvg: 18 },
    { trade: 'Electrical', yourMargin: 15, marketAvg: 20 },
    { trade: 'Plumbing', yourMargin: 19, marketAvg: 18 },
    { trade: 'Concreting', yourMargin: 16, marketAvg: 15 },
    { trade: 'Tiling', yourMargin: 25, marketAvg: 22 }
  ];

  // Price competitiveness (mock data)
  const tradeBreakdown = [
    { name: 'Carpentry', variance: -3, percentile: 35 },
    { name: 'Electrical', variance: 8, percentile: 72 },
    { name: 'Plumbing', variance: 2, percentile: 55 },
    { name: 'Concreting', variance: -5, percentile: 28 }
  ];

  // AI Optimization suggestions
  const optimizations = [
    {
      id: 1,
      title: 'Material Substitution Opportunity',
      description: 'Switch from MGP12 to MGP10 timber for non-load-bearing internal walls',
      savings: 1200,
      impact: 'medium' as const,
      category: 'cost'
    },
    {
      id: 2,
      title: 'Labour Rate Adjustment',
      description: 'Your plumbing labour rate ($125/hr) is 15% above market average ($108/hr)',
      savings: 850,
      impact: 'high' as const,
      category: 'labour'
    },
    {
      id: 3,
      title: 'Bulk Order Discount',
      description: 'Consolidate concrete pours to qualify for 5% bulk discount',
      savings: 680,
      impact: 'low' as const,
      category: 'materials'
    }
  ];

  const totalValue = costByCategory.reduce((sum, c) => sum + c.value, 0);

  return (
    <div className="space-y-6">
      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown by Trade</CardTitle>
          <CardDescription>Distribution of costs across different trades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    label={(entry) => `${entry.name}: $${(entry.value/1000).toFixed(0)}k`}
                    labelLine={false}
                  >
                    {costByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold mb-3">Category Breakdown</h4>
              {costByCategory.map(cat => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat.name}</span>
                    <span className="font-mono">${cat.value.toLocaleString()}</span>
                  </div>
                  <Progress value={(cat.value / totalValue) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {((cat.value / totalValue) * 100).toFixed(1)}% of total
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Margin Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Margin Analysis vs Market</CardTitle>
          <CardDescription>Compare your margins against market averages by trade</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={marginData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="trade" />
              <YAxis label={{ value: 'Margin %', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="yourMargin" fill="hsl(var(--primary))" name="Your Margin" />
              <Bar dataKey="marketAvg" fill="hsl(var(--muted-foreground))" name="Market Average" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Price Competitiveness */}
      <Card>
        <CardHeader>
          <CardTitle>Price Competitiveness Indicators</CardTitle>
          <CardDescription>How your pricing compares to market rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tradeBreakdown.map(trade => (
              <div key={trade.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{trade.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      trade.variance > 5 ? 'text-red-500' : 
                      trade.variance < -5 ? 'text-green-500' : 
                      'text-amber-500'
                    }`}>
                      {trade.variance > 0 ? '+' : ''}{trade.variance}% vs market
                    </span>
                    {trade.variance > 5 && <TrendingUp className="h-4 w-4 text-red-500" />}
                    {trade.variance < -5 && <TrendingDown className="h-4 w-4 text-green-500" />}
                    {Math.abs(trade.variance) <= 5 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </div>
                </div>
                <Progress value={trade.percentile} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {trade.percentile < 50 ? 'Lower than' : 'Higher than'} {trade.percentile}% of market quotes
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Optimization Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle>AI-Powered Optimization Suggestions</CardTitle>
          <CardDescription>Potential cost savings and improvements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {optimizations.map(opt => (
            <Alert key={opt.id} variant={opt.impact === 'high' ? 'default' : 'default'}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                {opt.title}
                <Badge variant={opt.impact === 'high' ? 'destructive' : opt.impact === 'medium' ? 'default' : 'secondary'}>
                  {opt.impact} impact
                </Badge>
              </AlertTitle>
              <AlertDescription>
                {opt.description}
                <br />
                <strong className="text-accent">Potential savings: ${opt.savings.toLocaleString()}</strong>
              </AlertDescription>
              <Button size="sm" variant="outline" className="mt-2">
                Apply Suggestion
              </Button>
            </Alert>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'Carpentry': '#0088FE',
    'Electrical': '#00C49F',
    'Plumbing': '#FFBB28',
    'Concreting': '#FF8042',
    'Tiling': '#8884d8',
    'Painting': '#82ca9d',
    'Roofing': '#ffc658',
    'Landscaping': '#8dd1e1'
  };
  return colors[category] || '#666666';
}
