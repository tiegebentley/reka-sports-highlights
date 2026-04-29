import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  generateCommentary,
  getCommentaryTypes,
  getTemplateCount,
  type CommentaryType,
  type CommentaryContext,
} from '../../lib/commentaryTemplates';

interface CommentaryEditorProps {
  clipId: string;
  videoId: string;
  onCommentaryGenerated?: (audioUrl: string) => void;
}

export const CommentaryEditor = ({
  clipId,
  videoId,
  onCommentaryGenerated,
}: CommentaryEditorProps) => {
  const [selectedType, setSelectedType] = useState<CommentaryType>('live-action');
  const [commentaryText, setCommentaryText] = useState('');
  const [context, setContext] = useState<CommentaryContext>({
    playerName: '',
    playerNumber: undefined,
    teamName: '',
    action: '',
  });
  const [selectedVoice, setSelectedVoice] = useState('21m00Tcm4TlvDq8ikWAM'); // Rachel (default)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Available ElevenLabs voices
  const voices = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Energetic, clear (great for sports)' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong, authoritative' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'Professional, engaging' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Deep, resonant' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Bright, enthusiastic' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Dynamic, versatile' },
  ];

  // Generate preview text when type or context changes
  useEffect(() => {
    if (selectedType && Object.values(context).some(v => v)) {
      try {
        const preview = generateCommentary(selectedType, context);
        setCommentaryText(preview);
      } catch (err) {
        console.error('Failed to generate preview:', err);
      }
    }
  }, [selectedType, context]);

  const handleContextChange = (field: keyof CommentaryContext, value: string | number) => {
    setContext(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateNewText = () => {
    try {
      const newText = generateCommentary(selectedType, context);
      setCommentaryText(newText);
    } catch (err) {
      setError('Failed to generate commentary text');
    }
  };

  const handleGenerateAudio = async () => {
    if (!commentaryText.trim()) {
      setError('Please enter or generate commentary text first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Call Supabase Edge Function
      const { data, error: functionError } = await supabase.functions.invoke(
        'generate-commentary',
        {
          body: {
            clipId,
            text: commentaryText,
            voiceId: selectedVoice,
            voiceSettings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true,
            },
          },
        }
      );

      if (functionError) throw functionError;

      if (data?.audioUrl) {
        setGeneratedAudioUrl(data.audioUrl);
        if (onCommentaryGenerated) {
          onCommentaryGenerated(data.audioUrl);
        }
      }
    } catch (err: any) {
      console.error('Failed to generate audio:', err);
      setError(err.message || 'Failed to generate audio commentary');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '24px',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: 'bold' }}>
        AI Commentary Generator
      </h2>

      {/* Commentary Type Selection */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
          Commentary Type
        </label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as CommentaryType)}
          style={{
            width: '100%',
            padding: '12px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
          }}
        >
          {getCommentaryTypes().map(type => (
            <option key={type} value={type}>
              {type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              {' '}({getTemplateCount(type)} templates)
            </option>
          ))}
        </select>
      </div>

      {/* Context Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
            Player Name
          </label>
          <input
            type="text"
            value={context.playerName || ''}
            onChange={(e) => handleContextChange('playerName', e.target.value)}
            placeholder="e.g., Alex Johnson"
            style={{
              width: '100%',
              padding: '12px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
            Jersey Number
          </label>
          <input
            type="number"
            value={context.playerNumber || ''}
            onChange={(e) => handleContextChange('playerNumber', parseInt(e.target.value) || undefined)}
            placeholder="e.g., 10"
            style={{
              width: '100%',
              padding: '12px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
            Team Name
          </label>
          <input
            type="text"
            value={context.teamName || ''}
            onChange={(e) => handleContextChange('teamName', e.target.value)}
            placeholder="e.g., Raleigh FC"
            style={{
              width: '100%',
              padding: '12px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
            Action/Event
          </label>
          <input
            type="text"
            value={context.action || ''}
            onChange={(e) => handleContextChange('action', e.target.value)}
            placeholder="e.g., scores with a header"
            style={{
              width: '100%',
              padding: '12px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {/* Commentary Text */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '14px', color: '#aaa' }}>
            Commentary Script
          </label>
          <button
            onClick={handleGenerateNewText}
            style={{
              padding: '6px 12px',
              background: '#333',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            🎲 Generate New Variation
          </button>
        </div>
        <textarea
          value={commentaryText}
          onChange={(e) => setCommentaryText(e.target.value)}
          placeholder="Enter commentary text or use the generator..."
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
          {commentaryText.length} characters
        </div>
      </div>

      {/* Voice Selection */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#aaa' }}>
          Voice
        </label>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
          }}
        >
          {voices.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name} - {voice.description}
            </option>
          ))}
        </select>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          background: '#3a1a1a',
          border: '1px solid #6a2a2a',
          borderRadius: '6px',
          color: '#ff6b6b',
          marginBottom: '16px',
          fontSize: '14px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerateAudio}
        disabled={isGenerating || !commentaryText.trim()}
        style={{
          width: '100%',
          padding: '16px',
          background: isGenerating || !commentaryText.trim() ? '#333' : '#4ECDC4',
          color: isGenerating || !commentaryText.trim() ? '#666' : '#0a0a0a',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: isGenerating || !commentaryText.trim() ? 'not-allowed' : 'pointer',
          marginBottom: '16px',
        }}
      >
        {isGenerating ? '🎙️ Generating Audio...' : '🎙️ Generate AI Commentary'}
      </button>

      {/* Generated Audio Player */}
      {generatedAudioUrl && (
        <div style={{
          padding: '16px',
          background: '#2a2a2a',
          border: '1px solid #4ECDC4',
          borderRadius: '6px',
        }}>
          <div style={{ marginBottom: '12px', fontSize: '14px', color: '#4ECDC4', fontWeight: 'bold' }}>
            ✅ Commentary Generated Successfully!
          </div>
          <audio
            controls
            src={generatedAudioUrl}
            style={{
              width: '100%',
            }}
          />
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#aaa' }}>
            Audio URL: <a href={generatedAudioUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4ECDC4' }}>
              {generatedAudioUrl}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
