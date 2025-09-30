/**
 * @module GroupVersionToggle
 * @description Toggle component for selecting between boy group and girl group versions
 * Optimized for mobile displays with proper touch targets and responsive design
 */
import React from 'react';
import PropTypes from 'prop-types';
import styles from './GroupVersionToggle.module.css';

const GroupVersionToggle = ({
  selectedVersion,
  onVersionChange,
  disabled = false,
  className = '',
  size = 'medium'
}) => {
  const handleVersionChange = (version) => {
    if (!disabled && onVersionChange) {
      onVersionChange(version);
    }
  };

  return (
    <div className={`${styles.groupVersionToggle} ${styles[size]} ${className}`}>
      <div className={styles.toggleContainer}>
        <button
          type="button"
          className={`${styles.toggleButton} ${styles.boyGroup} ${
            selectedVersion === 'boy' ? styles.active : ''
          } ${disabled ? styles.disabled : ''}`}
          onClick={() => handleVersionChange('boy')}
          disabled={disabled}
          aria-pressed={selectedVersion === 'boy'}
          aria-label="Select boy group version"
        >
          <span className={styles.buttonIcon}>👦</span>
          <span className={styles.buttonText}>Boy Group</span>
        </button>

        <button
          type="button"
          className={`${styles.toggleButton} ${styles.girlGroup} ${
            selectedVersion === 'girl' ? styles.active : ''
          } ${disabled ? styles.disabled : ''}`}
          onClick={() => handleVersionChange('girl')}
          disabled={disabled}
          aria-pressed={selectedVersion === 'girl'}
          aria-label="Select girl group version"
        >
          <span className={styles.buttonIcon}>👧</span>
          <span className={styles.buttonText}>Girl Group</span>
        </button>
      </div>
    </div>
  );
};

GroupVersionToggle.propTypes = {
  selectedVersion: PropTypes.oneOf(['boy', 'girl']).isRequired,
  onVersionChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large'])
};

GroupVersionToggle.displayName = 'GroupVersionToggle';

export default GroupVersionToggle;