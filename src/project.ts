import {makeProject} from '@motion-canvas/core';

import example from './scenes/example?scene';
import logo from './scenes/logo?scene';

export default makeProject({
  scenes: [logo, example],
});
