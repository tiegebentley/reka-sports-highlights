import { CommentaryEditor } from '../components/commentary/CommentaryEditor';

export const CommentaryDemo = () => {
  const handleCommentaryGenerated = (audioUrl: string) => {
    console.log('Commentary generated:', audioUrl);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          color: '#fff',
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            AI Commentary Generator
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#aaa',
            maxWidth: '600px',
            margin: '0 auto',
          }}>
            Generate professional sports commentary with AI-powered text-to-speech.
            Choose from multiple voices and commentary styles.
          </p>
        </div>

        <CommentaryEditor
          clipId="demo-clip-123"
          videoId="demo-video-456"
          onCommentaryGenerated={handleCommentaryGenerated}
        />

        {/* Feature Highlights */}
        <div style={{
          marginTop: '48px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
        }}>
          {[
            {
              icon: '🎭',
              title: '8 Commentary Types',
              description: 'Pre-game intros, live action, goal celebrations, and more',
            },
            {
              icon: '🎙️',
              title: '6 Professional Voices',
              description: 'Choose from energetic, authoritative, or engaging voices',
            },
            {
              icon: '📝',
              title: 'Smart Templates',
              description: 'Auto-generate contextual commentary based on player data',
            },
            {
              icon: '⚡',
              title: 'Instant Generation',
              description: 'High-quality audio in seconds powered by ElevenLabs',
            },
          ].map((feature, index) => (
            <div
              key={index}
              style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                {feature.icon}
              </div>
              <h3 style={{
                color: '#fff',
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '8px',
              }}>
                {feature.title}
              </h3>
              <p style={{
                color: '#aaa',
                fontSize: '14px',
                lineHeight: '1.6',
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: '48px',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '24px',
          color: '#fff',
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>
            Quick Start Guide
          </h3>
          <ol style={{ paddingLeft: '24px', color: '#aaa', lineHeight: '2' }}>
            <li>Select a <strong>commentary type</strong> (e.g., "Live Action" or "Goal Celebration")</li>
            <li>Fill in the <strong>context fields</strong> (player name, number, team, action)</li>
            <li>The system will <strong>auto-generate</strong> a natural-sounding script</li>
            <li>Customize the text if needed, or click "Generate New Variation"</li>
            <li>Choose a <strong>voice</strong> that matches your style</li>
            <li>Click <strong>"Generate AI Commentary"</strong> to create the audio</li>
            <li>Play the audio directly or download for use in your videos</li>
          </ol>
        </div>

        {/* API Configuration Note */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#2a2a1a',
          border: '1px solid #4a4a2a',
          borderRadius: '6px',
          color: '#e6db74',
          fontSize: '14px',
        }}>
          <strong>⚙️ Setup Required:</strong> To use this feature, add your ElevenLabs API key to
          <code style={{ padding: '2px 6px', background: '#1a1a1a', borderRadius: '3px', margin: '0 4px' }}>
            supabase/.env
          </code>
          as <code style={{ padding: '2px 6px', background: '#1a1a1a', borderRadius: '3px', margin: '0 4px' }}>
            ELEVENLABS_API_KEY=your_key
          </code>
        </div>
      </div>
    </div>
  );
};
