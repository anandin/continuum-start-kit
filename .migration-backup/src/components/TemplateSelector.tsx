import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { providerTemplates, ProviderTemplate } from '@/data/providerTemplates';
import { CheckCircle2, Sparkles } from 'lucide-react';

interface TemplateSelectorProps {
  onSelectTemplate: (template: ProviderTemplate) => void;
}

export default function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Choose Your Framework</h1>
              <p className="text-muted-foreground">Select a pre-built template or start from scratch</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {providerTemplates.map((template) => (
            <Card
              key={template.id}
              className="relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer group"
              onClick={() => onSelectTemplate(template)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {template.name}
                  </CardTitle>
                  {template.id !== 'blank' && (
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
                <CardDescription className="text-sm">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {template.id !== 'blank' && (
                    <>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Stages</p>
                        <p className="text-sm">{template.stages.length} progression stages</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Focus Areas</p>
                        <div className="flex flex-wrap gap-1">
                          {template.labels.slice(0, 3).map((label, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                            >
                              {label}
                            </span>
                          ))}
                          {template.labels.length > 3 && (
                            <span className="inline-block px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                              +{template.labels.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  <Button
                    variant={template.id === 'blank' ? 'outline' : 'default'}
                    className="w-full mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTemplate(template);
                    }}
                  >
                    {template.id === 'blank' ? 'Start Fresh' : 'Use This Template'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
