import React from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Cpu, 
  Database, 
  Target, 
  Users, 
  Zap, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function HelpPage() {
  const workflowSteps = [
    {
      title: "1. Team Directory Setup",
      description: "Before uploading, ensure your teams and players (names + numbers) are in the Directory.",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "2. Video Upload",
      description: "Upload your game video. High-angle tactical views work best for tracking.",
      icon: Zap,
      color: "text-primary",
      bg: "bg-primary/10"
    },
    {
      title: "3. Identity Allocation",
      description: "Use 'Edit Teams' to link the video to your actual Directory Teams and set jersey colors.",
      icon: Target,
      color: "text-accent",
      bg: "bg-accent/10"
    },
    {
      title: "4. Deep AI Analysis",
      description: "Trigger 'Re-analyze Game' to start the GPU engine with your specific roster mapping.",
      icon: Cpu,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      title: "5. Stats Synchronization",
      description: "Once complete, click 'Sync Stats' to generate the accurate 1-6 box score and charts.",
      icon: RefreshCw,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    }
  ];

  const modules = [
    {
      id: "module-1",
      name: "Identity & Mapping",
      purpose: "Bridges the gap between AI 'Jersey Numbers' and your 'Player Directory'.",
      keyFeature: "Automatic roster snapshots."
    },
    {
      id: "module-2",
      name: "Event-Driven PBP",
      purpose: "Generates raw play-by-play (Makes/Misses/TOs) with timestamps.",
      keyFeature: "Video clip integration."
    },
    {
      id: "module-3",
      name: "Aggregated Stats",
      purpose: "Calculates total points (including 1pt FT), rebounds, and FG%.",
      keyFeature: "Accurate 1-6 score tracking."
    },
    {
      id: "module-4",
      name: "Spatial Analytics",
      purpose: "Plots X/Y shot data onto the interactive court.",
      keyFeature: "Heatmaps and shot selection."
    },
    {
      id: "module-5",
      name: "Elite Insights",
      purpose: "AI-driven tactical advice and defensive mapping.",
      keyFeature: "Automated coach feedback."
    }
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-2">
          <Badge variant="outline" className="border-primary/50 text-primary px-3 py-1 uppercase tracking-widest text-[10px] mb-2">
            System Documentation
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            DribbleStats AI Elite Guide
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Learn how the modular scouting system transforms raw video into professional-grade analytics.
          </p>
        </div>

        {/* The Workflow */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" /> The Elite Workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {workflowSteps.map((step, idx) => (
              <Card key={idx} className="bg-card/40 border-white/5 relative overflow-hidden group hover:border-primary/30 transition-all">
                <div className={cn("absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity", step.color)}>
                  <step.icon className="h-16 w-16" />
                </div>
                <CardHeader className="pb-2">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-2", step.bg)}>
                    <step.icon className={cn("h-5 w-5", step.color)} />
                  </div>
                  <CardTitle className="text-sm">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
                {idx < workflowSteps.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-white/20">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Module Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-accent" /> Modular Architecture
            </h2>
            <div className="space-y-4">
              {modules.map((mod) => (
                <div key={mod.id} className="flex gap-4 p-4 rounded-xl bg-card/40 border border-white/5 hover:bg-white/5 transition-colors group">
                  <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <span className="text-xl font-bold text-white/20 group-hover:text-primary transition-colors">{mod.id.split('-')[1]}</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-white group-hover:text-primary transition-colors">{mod.name}</h3>
                    <p className="text-sm text-muted-foreground">{mod.purpose}</p>
                    <div className="pt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider font-mono text-accent">
                      <CheckCircle2 className="h-3 w-3" /> Core Feature: {mod.keyFeature}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-blue-400" /> Pro Tips & FAQ
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-white/5">
                <AccordionTrigger className="text-sm hover:no-underline hover:text-primary">Re-sync vs. Re-analyze?</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-white block mb-1">Re-sync:</strong> Just refreshes the dashboard from existing data. Fast and free. Use when you update a player name in the directory.
                  <br /><br />
                  <strong className="text-white block mb-1">Re-analyze:</strong> Restarts the AI engine. Use when you change teams, jersey colors, or analysis modes.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-white/5">
                <AccordionTrigger className="text-sm hover:no-underline hover:text-primary">"Home/Away" showing instead of names?</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                  Go to the Game Detail page, click <strong className="text-white">Edit Teams</strong>, select your actual Directory Teams, and click <strong className="text-white">Save & Re-analyze</strong>. The AI will then map jersey numbers to your rosters.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="border-white/5">
                <AccordionTrigger className="text-sm hover:no-underline hover:text-primary">Jersey color matters!</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                  Always ensure the jersey color in 'Edit Teams' matches what the players are wearing in the video. If swapped, the score (e.g., 1-6) will be attributed to the wrong team.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4" className="border-white/5">
                <AccordionTrigger className="text-sm hover:no-underline hover:text-primary">Score is inaccurate?</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                  The modular system calculates score from Play-by-Play events. Ensure you have performed a <strong className="text-white">Deep Sync</strong> after analysis is complete to aggregate all events (including 1pt Free Throws).
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Card className="bg-primary/10 border-primary/20 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-primary">Need Elite Support?</p>
                  <p className="text-xs text-muted-foreground">For complex analysis failures or video processing errors, contact the performance lab via the dashboard.</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { cn } from "@/lib/utils";