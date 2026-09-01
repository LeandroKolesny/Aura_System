import React from 'react';
import { Player } from '@remotion/player';
import { AuraDemoComposition } from './AuraDemoComposition';

const LandingDemoPlayer: React.FC<{ tabIndex: number }> = ({ tabIndex }) => (
  <Player
    component={AuraDemoComposition}
    inputProps={{ tabIndex }}
    durationInFrames={150}
    compositionWidth={720}
    compositionHeight={440}
    fps={30}
    loop
    autoPlay
    style={{ width: '100%', display: 'block' }}
  />
);

export default LandingDemoPlayer;
