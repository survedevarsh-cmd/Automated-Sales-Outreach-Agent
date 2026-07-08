import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured' },
        { status: 500 }
      );
    }

    const {
      company_url,
      generated_email,
      ai_research,
      feedback_text,
      rating,
      feature_requested,
      personalized_enough,
    } = body;

    const { data, error } = await supabase
      .from('feedback')
      .insert([
        {
          company_url,
          generated_email,
          ai_research,
          feedback_text,
          rating,
          feature_requested,
          personalized_enough,
        },
      ])
      .select();

    if (error) {
      console.error('Error inserting feedback:', error);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error processing feedback request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
