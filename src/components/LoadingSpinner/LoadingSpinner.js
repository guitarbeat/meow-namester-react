/**
 * @module LoadingSpinner
 * @description A simple cat-themed loading spinner component
 *
 * @example
 * // Default size
 * {isLoading && <LoadingSpinner />}
 *
 * // Custom size
 * {isLoading && <LoadingSpinner size="large" />}
 *
 * // With loading text
 * {isLoading && <LoadingSpinner text="Loading..." />}
 *
 * @component
 * @param {Object} props
 * @param {('small'|'medium'|'large')} [props.size='medium'] - Size variant of the spinner
 * @param {string} [props.text] - Optional loading text to display below the spinner
 * @returns {JSX.Element} A simple cat emoji loading spinner
 */

import React from "react";
import PropTypes from "prop-types";
import styles from "./LoadingSpinner.module.css";

/**
 * A simple, reliable loading spinner component that provides visual feedback
 * during asynchronous operations using a cat emoji.
 *
 * @param {Object} props
 * @param {('small'|'medium'|'large')} [props.size='medium'] - Size variant of the spinner
 * @param {string} [props.text] - Optional loading text to display below the spinner
 * @returns {JSX.Element}
 */
const LoadingSpinner = ({ size = "medium", text }) => {
  return (
    <div className={styles.container} role="status" aria-label="Loading">
      <div className={`${styles.spinner} ${styles[size]}`}>🐈‍⬛</div>
      {text && <p className={styles.text}>{text}</p>}
      <span className={styles.srOnly}>Loading...</span>
    </div>
  );
};

LoadingSpinner.displayName = "LoadingSpinner";

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(["small", "medium", "large"]),
  text: PropTypes.string,
};

export default LoadingSpinner;
